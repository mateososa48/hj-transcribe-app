import { useEffect, useRef, useState } from 'react';
import { EditorContent, useEditor, type Content } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Placeholder } from '@tiptap/extensions';
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
import { PagedSheet } from './PagedSheet';
import { PagePushes } from './pagination';
import { ImportDialog } from './ImportDialog';
import { abschnittToNodes, bulletsToTiptap, sectionToTiptap } from './insert';
import { editorRegistry } from './editor-registry';
import { insertTitledContent } from './merge';
import { ErgaenzungList } from '@/features/session/Ergaenzung';


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
  const [ergVersion, setErgVersion] = useState(0);
  const insertPosRef = useRef<number | null>(null);

  const editor = useEditor({
    extensions: [
      StarterKit,
      TextStyle,
      FontSize,
      // Keeps page edges out of the middle of his sentences.
      PagePushes,
      // Empty sections must not look dead: the paragraph under each heading
      // says what he can do there until he does it.
      Placeholder.configure({
        showOnlyCurrent: false,
        placeholder: ({ editor, node, pos }) => {
          if (node.type.name !== 'paragraph' || node.content.size > 0) return '';
          // The decoration scan can hand positions from a newer doc than
          // editor.state during a transaction — resolve defensively.
          try {
            if (pos > editor.state.doc.content.size) return '';
            const before = editor.state.doc.resolve(pos).nodeBefore;
            return before?.type.name === 'heading'
              ? 'Schreiben, mit + diktieren oder über „Einfügen" übernehmen …'
              : '';
          } catch {
            return '';
          }
        },
      }),
    ],
    content: record.content as Content,
    editorProps: {
      attributes: {
        class: 'tiptap flex-1 text-base',
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

  // Whoever finishes a dictation later must find THIS editor, not a stale one.
  useEffect(() => {
    if (!editor) return;
    editorRegistry.set(record.id, editor);
    return () => editorRegistry.remove(record.id, editor);
  }, [editor, record.id]);

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

  /**
   * Snapshot before a programmatic write, then offer one-step undo on the
   * toast — an AI insert into a half-finished letter must never be a
   * one-way door.
   */
  const withUndo = (write: () => void, doneText: string) => {
    if (!editor || editor.isDestroyed) return;
    const snapshot = editor.getJSON();
    void saveDocument(record.id, { previousContent: snapshot });
    write();
    toast.success(doneText, {
      action: {
        label: 'Rückgängig',
        onClick: () => {
          editor.commands.setContent(snapshot);
          void saveDocument(record.id, { content: snapshot });
        },
      },
      duration: 8000,
    });
  };

  /** Insert a finished dictation — or persist it even if the editor is gone. */
  const insertAbschnitt = (heading: string | null, text: string) => {
    if (editor && !editor.isDestroyed) {
      withUndo(() => {
        if (heading) {
          // An announced section fills the letter's OWN section of that name
          // instead of stamping a second heading.
          insertTitledContent(editor, heading, bulletsToTiptap(text));
        } else {
          const max = editor.state.doc.content.size;
          const pos = Math.min(insertPosRef.current ?? max, max);
          editor.commands.insertContentAt(pos, abschnittToNodes(null, text) as Content, {
            updateSelection: false,
          });
        }
      }, 'Diktat eingefügt.');
    } else {
      // The page was left mid-processing. If the document was reopened, a
      // LIVE editor exists — write through it so the next autosave cannot
      // clobber the insert; only a truly closed document appends to the
      // store directly. The dictation is never lost either way.
      const liveEditor = editorRegistry.get(record.id);
      const nodes = abschnittToNodes(heading, text);
      if (liveEditor) {
        liveEditor.commands.insertContentAt(liveEditor.state.doc.content.size, nodes as Content, {
          updateSelection: false,
        });
      } else {
        void appendToDocument(record.id, nodes);
      }
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
    <div className="flex min-h-0 flex-1 flex-col">
      {/* The title sits at the very top of the working area, the way a
          document names itself — no label above it, nothing between it and
          the instrument row. */}
      <div className="flex items-center gap-3 px-4 pt-6 pb-3 sm:px-6">
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={() => void saveTitle()}
          onKeyDown={(e) => {
            if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
          }}
          aria-label="Titel des Berichts"
          className="h-11 flex-1 rounded-lg border-transparent bg-transparent px-2 text-2xl font-semibold tracking-tight shadow-none transition-[background-color,border-color,box-shadow] duration-[250ms] ease-[cubic-bezier(0.22,1,0.36,1)] hover:border-border/60 hover:bg-muted/40 focus-visible:border-border focus-visible:bg-background md:text-2xl"
        />
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

      {editor ? (
        <EditorToolbar
          editor={editor}
          documentTitle={title}
          onImport={() => setImporting(true)}
          onDictate={() => {
            insertPosRef.current = Math.min(
              editor.state.selection.to,
              editor.state.doc.content.size,
            );
            setDictating(true);
          }}
        />
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

      {/* The page on the desk: a quiet canvas, one full sheet of A4. */}
      <PagedSheet editor={editor}>
        <EditorContent editor={editor} className="flex flex-1 flex-col" />
      </PagedSheet>

      {/* The source stays beside the draft: every dictation into this
          Bericht remains playable, with its follow-along transcript. */}
      <div className="border-t border-border bg-card empty:hidden">
        <ErgaenzungList
          sessionId={record.id}
          version={ergVersion}
          label="Diktat"
          title="Diktate in diesem Bericht"
        />
      </div>

      <ImportDialog
        open={importing}
        onOpenChange={setImporting}
        onInsert={(sections) => {
          if (!editor || editor.isDestroyed) return;
          withUndo(() => {
            for (const s of sections) {
              // Each section merges into the letter's matching section
              // (Medikation lands under Aktuelle Therapie); only genuinely
              // new titles create a heading.
              insertTitledContent(editor, s.label, sectionToTiptap(s.key, s.text));
            }
          }, 'Eingefügt.');
        }}
      />

      {dictating ? (
        <RecorderPopup
          parentId={record.id}
          ariaLabel="Abschnitt diktieren"
          processingText="Der Abschnitt wird erstellt …"
          successText="Eingefügt"
          process={async (childId) => {
            const { heading, text } = await processAbschnittDiktat(childId);
            insertAbschnitt(heading, text);
          }}
          onDone={() => {
            insertPosRef.current = null;
            setErgVersion((v) => v + 1);
          }}
          onClose={() => setDictating(false)}
        />
      ) : null}
    </div>
  );
}
