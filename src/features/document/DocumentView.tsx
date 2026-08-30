import { useEffect, useRef, useState } from 'react';
import { EditorContent, useEditor, type Content, type Editor } from '@tiptap/react';
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
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { db, newId, type DocumentRecord } from '@/lib/db';
import { deleteDocument, saveDocument } from '@/lib/documents';
import { useAppStore } from '@/store/app-store';
import { RecorderPopup } from '@/features/record/RecorderPopup';
import { DictationJobList, useDictationJobs } from '@/features/record/dictation-jobs';
import { appendToDocument } from '@/lib/documents';
import { processAbschnittDiktat } from './dictate';
import { EditorToolbar } from './EditorToolbar';
import { DictationRail } from './DictationRail';
import { PagedSheet } from './PagedSheet';
import { PagePushes } from './pagination';
import { SectionInvite } from './section-invite';
import type { DictateTarget } from './dictate-target';
import { ImportDialog } from './ImportDialog';
import {
  abschnittToNodes,
  bulletsToTiptap,
  canonicalSectionTitle,
  sectionToTiptap,
} from './insert';
import { editorRegistry } from './editor-registry';
import { insertTitledContent } from './merge';


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
  /** The one open recording window — one microphone, one recording at a time. */
  const [dictating, setDictating] = useState<DictateTarget | null>(null);
  const [importing, setImporting] = useState(false);
  const [ergVersion, setErgVersion] = useState(0);
  /** Dictations still being written up. Any number, each with its own target. */
  const jobs = useDictationJobs();
  /**
   * Where each pending "an der Schreibmarke" dictation is to land, keyed per
   * job — several can be in flight at once, and every one of them is kept
   * honest against his concurrent typing by mapping it through transactions.
   */
  const insertPositions = useRef(new Map<string, number>());
  /** The caret at the moment the window opened, before he has spoken. */
  const pendingPosRef = useRef<number | null>(null);
  /** Lets the editor extension reach the current handler without re-creating. */
  const inviteRef = useRef<(title: string) => void>(() => {});

  const editor = useEditor({
    extensions: [
      StarterKit,
      TextStyle,
      FontSize,
      // Keeps page edges out of the middle of his sentences.
      PagePushes,
      // Every empty section carries its own invitation to dictate, in the
      // line where the words will land.
      SectionInvite.configure({
        label: 'Diktieren',
        onDictate: (title) => inviteRef.current(title),
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
      if (pendingPosRef.current !== null) {
        pendingPosRef.current = transaction.mapping.map(pendingPosRef.current);
      }
      for (const [key, pos] of insertPositions.current) {
        insertPositions.current.set(key, transaction.mapping.map(pos));
      }
    };
    editor.on('transaction', onTransaction);
    return () => {
      editor.off('transaction', onTransaction);
    };
  }, [editor]);

  /**
   * Snapshot before a programmatic write and hand back the way out — an AI
   * insert into a half-finished letter must never be a one-way door.
   */
  const snapshotAndWrite = (target: Editor, write: () => void): (() => void) => {
    const snapshot = target.getJSON();
    void saveDocument(record.id, { previousContent: snapshot });
    write();
    return () => {
      if (target.isDestroyed) return;
      target.commands.setContent(snapshot);
      void saveDocument(record.id, { content: snapshot });
    };
  };

  /** The same, with the undo offered on a toast. */
  const withUndo = (write: () => void, doneText: string) => {
    if (!editor || editor.isDestroyed) return;
    const undo = snapshotAndWrite(editor, write);
    toast.success(doneText, {
      action: { label: 'Rückgängig', onClick: undo },
      duration: 8000,
    });
  };

  /**
   * Insert a finished dictation — or persist it even if the editor is gone.
   * A section he picked by name outranks any section the model heard him
   * announce: the destination he chose before speaking is the promise, and it
   * travels WITH the dictation, so a second one started meanwhile cannot
   * redirect it.
   *
   * Returns the undo, for the job's own card.
   */
  const insertAbschnitt = (
    target: DictateTarget,
    heading: string | null,
    text: string,
    posKey: string,
  ): (() => void) | undefined => {
    const title = target.kind === 'section' ? target.title : heading;
    // The page may have been left mid-processing. If the document was
    // reopened, a LIVE editor exists — write through it so the next autosave
    // cannot clobber the insert; only a truly closed document appends to the
    // store directly. The dictation is never lost either way.
    const live = editor && !editor.isDestroyed ? editor : editorRegistry.get(record.id);
    const pos = insertPositions.current.get(posKey);
    insertPositions.current.delete(posKey);

    if (!live) {
      void appendToDocument(record.id, abschnittToNodes(title, text));
      return undefined;
    }
    return snapshotAndWrite(live, () => {
      if (title) {
        // A named section fills the letter's OWN section of that name instead
        // of stamping a second heading.
        insertTitledContent(live, title, bulletsToTiptap(text));
      } else {
        const max = live.state.doc.content.size;
        live.commands.insertContentAt(Math.min(pos ?? max, max), abschnittToNodes(null, text) as Content, {
          updateSelection: false,
        });
      }
    });
  };

  /**
   * Finished recording -> its own job. Everything it needs is captured here,
   * so it no longer matters what he does next — including starting the next
   * dictation while this one is still being written.
   */
  const enqueueDictation = (target: DictateTarget, childId: string) => {
    const posKey = newId();
    if (target.kind === 'cursor' && pendingPosRef.current !== null) {
      insertPositions.current.set(posKey, pendingPosRef.current);
    }
    pendingPosRef.current = null;
    const where = target.kind === 'section' ? `„${target.title}"` : null;
    // Record where it is headed straight away, so the widget beside the letter
    // can name the section while the dictation is still being written up.
    if (target.kind === 'section') {
      void db.sessions.update(childId, { targetSection: target.title });
    }
    jobs.enqueue({
      processingText: where ? `${where} wird geschrieben …` : 'Der Abschnitt wird erstellt …',
      successText: where ? `In ${where} eingefügt` : 'Diktat eingefügt',
      run: async () => {
        const { heading, text } = await processAbschnittDiktat(childId);
        const undo = insertAbschnitt(target, heading, text, posKey);
        // Where it actually landed: the section he picked, or — for one aimed
        // at the caret — whichever section the model heard him announce.
        await db.sessions.update(childId, {
          targetSection:
            target.kind === 'section'
              ? target.title
              : heading
                ? canonicalSectionTitle(heading)
                : 'An der Schreibmarke',
        });
        setErgVersion((v) => v + 1);
        return undo;
      },
    });
  };

  /** One recording at a time; processing is what runs in parallel. */
  const openDictation = (target: DictateTarget) => {
    if (dictating) {
      toast.info('Bitte beenden Sie zuerst das laufende Diktat.');
      return;
    }
    pendingPosRef.current =
      target.kind === 'cursor' && editor
        ? Math.min(editor.state.selection.to, editor.state.doc.content.size)
        : null;
    setDictating(target);
  };

  // The invitations live inside the editor extension; this is how they reach
  // the current handler without the extension being re-created.
  inviteRef.current = (title: string) => openDictation({ kind: 'section', title });

  // DEV scaffold: exercise insertion and the full dictation path without a
  // microphone (see the verification battery).
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const SCAFFOLD_KEY = '__scaffold__';
    const scaffold = {
      documentId: record.id,
      insertParsed: (heading: string | null, text: string) =>
        insertAbschnitt({ kind: 'cursor' }, heading, text, SCAFFOLD_KEY),
      /** As if he had picked the section by name before speaking. */
      insertInto: (title: string, text: string) =>
        insertAbschnitt({ kind: 'section', title }, null, text, SCAFFOLD_KEY),
      enqueueDictation,
      processAbschnittDiktat,
      setInsertPos: (pos: number | null) => {
        if (pos === null) insertPositions.current.delete(SCAFFOLD_KEY);
        else insertPositions.current.set(SCAFFOLD_KEY, pos);
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
          recording={dictating !== null}
          onDictate={openDictation}
        />
      ) : null}

      {/* The page on the desk, with its sources beside it: the recordings
          dictated into this Bericht sit in a narrow column to the right,
          which shifts the sheet left only once there is something to show. */}
      <div className="flex min-h-0 flex-1">
        <PagedSheet editor={editor}>
          <EditorContent editor={editor} className="flex flex-1 flex-col" />
        </PagedSheet>
        <DictationRail documentId={record.id} version={ergVersion} />
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

      {/* The dictations still being written up, in the bottom-right corner —
          so the next one can start while they work. They ride up out of the
          way while a recording window is open on the same edge. */}
      <DictationJobList
        jobs={jobs.jobs}
        raised={dictating !== null}
        onRetry={jobs.retry}
        onDiscard={jobs.discard}
      />

      {dictating ? (
        <RecorderPopup
          parentId={record.id}
          ariaLabel={
            dictating.kind === 'section'
              ? `In „${dictating.title}" diktieren`
              : 'An der Schreibmarke diktieren'
          }
          destination={
            dictating.kind === 'section'
              ? `In „${dictating.title}"`
              : 'An der Schreibmarke'
          }
          onCaptured={(childId) => enqueueDictation(dictating, childId)}
          onClose={() => {
            pendingPosRef.current = null;
            setDictating(null);
          }}
        />
      ) : null}
    </div>
  );
}
