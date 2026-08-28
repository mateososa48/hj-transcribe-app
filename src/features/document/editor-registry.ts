import type { Editor } from '@tiptap/react';

/**
 * The live editor per open Bericht. A dictation that finishes after ITS
 * editor unmounted must not write a stale store while a NEW editor for the
 * same document is open — the next autosave would clobber it. The registry
 * lets the finish handler find whichever editor is alive right now.
 */
const live = new Map<string, Editor>();

export const editorRegistry = {
  set(documentId: string, editor: Editor): void {
    live.set(documentId, editor);
  },
  remove(documentId: string, editor: Editor): void {
    if (live.get(documentId) === editor) live.delete(documentId);
  },
  get(documentId: string): Editor | undefined {
    const editor = live.get(documentId);
    return editor && !editor.isDestroyed ? editor : undefined;
  },
};
