import { useEffect, useRef, useState } from 'react';
import { EditorContent, useEditor, type Content } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { FontSize, TextStyle } from '@tiptap/extension-text-style';
import { Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { db, type DocumentRecord } from '@/lib/db';
import { deleteDocument, saveDocument } from '@/lib/documents';
import { useAppStore } from '@/store/app-store';
import { RecorderPopup } from '@/features/record/RecorderPopup';
import { appendToDocument } from '@/lib/documents';
import { BlockHandle } from './BlockHandle';
import { processAbschnittDiktat } from './dictate';
import { EditorToolbar } from './EditorToolbar';
import { ImportDialog } from './ImportDialog';
import { abschnittToNodes, sectionToTiptap } from './insert';


const AUTOSAVE_MS = 800;

/**
 * The Bericht: his letter as a page he owns. A Word-feeling sheet on a quiet
 * canvas, a toolbar of the app's own keys above it, and — unlike Word —
 * a document he can dictate into and fill from his recordings.
 */
export function DocumentView({ documentId }: { documentId: string }) {
  const [record, setRecord] = useState<DocumentRecord | null | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    void db.documents.get(documentId).then((row) => {
      if (!cancelled) setRecord(row ?? null);
    });
    return () => {
      cancelled = true;
    };
  }, [documentId]);

  if (record === undefined) {
    return (
      <p className="flex items-center gap-3 text-muted-foreground">
        <Spinner /> Wird geladen …
      </p>
    );
  }
  if (record === null) {
    return <p className="text-muted-foreground">Diesen Bericht gibt es nicht mehr.</p>;
  }

  // Keyed remount per document: the editor and its autosave never see a
  // documentId change mid-life, which retires that entire race class.
  return <LoadedDocument key={record.id} record={record} />;
}

function LoadedDocument({ record }: { record: DocumentRecord }) {
  const goHome = useAppStore((s) => s.goHome);
  const touchSessions = useAppStore((s) => s.touchSessions);
  const [title, setTitle] = useState(record.title);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Open dictation popup + the live insert position (transaction-mapped). */
  const [dictating, setDictating] = useState(false);
  const [importing, setImporting] = useState(false);
  const insertPosRef = useRef<number | null>(null);

  const editor = useEditor({
    extensions: [StarterKit, TextStyle, FontSize],
    content: record.content as Content,
    editorProps: {
      attributes: {
        class: 'tiptap min-h-[62vh] text-base',
        'aria-label': 'Bericht',
      },
    },
    onUpdate: ({ editor }) => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(
        () => void saveDocument(record.id, { content: editor.getJSON() }),
        AUTOSAVE_MS,
      );
    },
  });

  // While a dictation is pending, keep its insert position honest against
  // his concurrent edits: map it through every transaction.
  useEffect(() => {
    if (!editor) return;
    const onTransaction = ({ transaction }: { transaction: { mapping: { map: (p: number) => number } } }) => {
      if (insertPosRef.current !== null) {
        insertPosRef.current = transaction.mapping.map(insertPosRef.current);
      }
    };
    editor.on('transaction', onTransaction);
    return () => {
      editor.off('transaction', onTransaction);
    };
  }, [editor]);

  /** Insert a finished dictation — or persist it even if the editor is gone. */
  const insertAbschnitt = (heading: string | null, text: string) => {
    const nodes = abschnittToNodes(heading, text);
    if (editor && !editor.isDestroyed) {
      const max = editor.state.doc.content.size;
      const pos = Math.min(insertPosRef.current ?? max, max);
      editor.commands.insertContentAt(pos, nodes as Content, { updateSelection: false });
    } else {
      // The page was left mid-processing — the dictation is never lost.
      void appendToDocument(record.id, nodes);
    }
  };

  // DEV scaffold: exercise insertion and the full dictation path without a
  // microphone (see the verification battery).
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const scaffold = {
      documentId: record.id,
      insertParsed: (heading: string | null, text: string) => insertAbschnitt(heading, text),
      processAbschnittDiktat,
      setInsertPos: (pos: number | null) => {
        insertPosRef.current = pos;
      },
    };
    (window as unknown as Record<string, unknown>).__berichtTest = scaffold;
    return () => {
      if ((window as unknown as Record<string, unknown>).__berichtTest === scaffold) {
        delete (window as unknown as Record<string, unknown>).__berichtTest;
      }
    };
  });

  // Flush the working copy when the page is left mid-debounce.
  useEffect(
    () => () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      if (editor && !editor.isDestroyed) {
        void saveDocument(record.id, { content: editor.getJSON() });
      }
    },
    [editor, record.id],
  );

  async function saveTitle() {
    const trimmed = title.trim();
    const next = trimmed || record.title;
    setTitle(next);
    await saveDocument(record.id, { title: next });
    touchSessions();
  }

  return (
    <div className="space-y-6 pb-16">
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <Badge variant="outline">Bericht</Badge>
          <AlertDialog>
            <AlertDialogTrigger
              render={
                <Button variant="ghost" className="text-muted-foreground">
                  <Trash2 aria-hidden />
                  Löschen
                </Button>
              }
            />
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Bericht wirklich löschen?</AlertDialogTitle>
                <AlertDialogDescription>
                  Der Bericht und alle hinein diktierten Aufnahmen werden von diesem Computer
                  entfernt. Das lässt sich nicht rückgängig machen.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                <AlertDialogAction
                  variant="destructive"
                  onClick={async () => {
                    await deleteDocument(record.id);
                    touchSessions();
                    toast.success('Bericht gelöscht.');
                    goHome();
                  }}
                >
                  Endgültig löschen
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>

        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={() => void saveTitle()}
          onKeyDown={(e) => {
            if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
          }}
          aria-label="Titel des Berichts"
          className="h-auto border-transparent px-0 text-2xl font-semibold tracking-tight shadow-none focus-visible:border-border focus-visible:px-2 md:text-2xl"
        />
      </div>

      {editor ? (
        <EditorToolbar editor={editor} documentTitle={title} onImport={() => setImporting(true)} />
      ) : null}
      {editor ? (
        <BlockHandle
          editor={editor}
          onDictate={(pos) => {
            insertPosRef.current = pos;
            setDictating(true);
          }}
        />
      ) : null}

      {/* The page on the desk: a quiet canvas, one sheet. */}
      <div className="rounded-xl bg-muted/40 px-4 py-8 sm:px-8 sm:py-10">
        <div className="mx-auto max-w-[52rem] rounded-lg border border-border bg-card px-8 py-10 sm:px-16 sm:py-14">
          <EditorContent editor={editor} />
        </div>
      </div>

      <ImportDialog
        open={importing}
        onOpenChange={setImporting}
        onInsert={(sections) => {
          if (!editor || editor.isDestroyed) return;
          const nodes = sections.flatMap((s) => [
            {
              type: 'heading',
              attrs: { level: 2 },
              content: [{ type: 'text', text: s.label }],
            },
            ...sectionToTiptap(s.key, s.text),
          ]);
          const end = editor.state.doc.content.size;
          const at = Math.min(editor.state.selection.to, end);
          editor.commands.insertContentAt(at, nodes as Content, { updateSelection: false });
        }}
      />

      {dictating ? (
        <RecorderPopup
          parentId={record.id}
          ariaLabel="Abschnitt diktieren"
          processingText="Der Abschnitt wird erstellt …"
          process={async (childId) => {
            const { heading, text } = await processAbschnittDiktat(childId);
            insertAbschnitt(heading, text);
          }}
          onDone={() => {
            insertPosRef.current = null;
          }}
          onClose={() => setDictating(false)}
        />
      ) : null}
    </div>
  );
}
