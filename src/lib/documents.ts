import {
  berichtTemplateDoc,
  isEmptyBody,
  isTemplateBody,
  leererBerichtDoc,
} from '@/features/document/insert.ts';
import { db, newId, type DocumentRecord } from '@/lib/db.ts';
import { deleteSession } from '@/lib/generate.ts';

/**
 * Berichte: create, save, delete — and one guarantee that matters more than
 * the rest: a dictation that finishes after its editor closed is APPENDED to
 * the stored document instead of being dropped. Nothing he spoke is lost.
 */

/**
 * His letter template now lives beside the check that reads it back —
 * berichtTemplateDoc in features/document/insert.ts. Keeping the shape and
 * "has he touched this?" in one file is what stops the two drifting: change
 * the template alone and an untouched Bericht stops being recognised as one.
 */
function templateContent(): unknown {
  return berichtTemplateDoc();
}

/**
 * What a new Bericht starts as: his letter template, or a blank page. Asked
 * once, at the moment he presses "Bericht erstellen" — see NewBerichtDialog.
 */
export type BerichtStart = 'vorlage' | 'leer';

/**
 * The name a Bericht is born with. Derived from its creation time rather than
 * stored, so asking "has he named this himself?" later is just asking whether
 * the title still matches the one it would have been given.
 */
export function defaultDocumentTitle(createdAt: number): string {
  const when = new Date(createdAt);
  const day = when.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
  const time = when.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
  return `Bericht ${day}, ${time} Uhr`;
}

/**
 * The first line a Bericht actually says — its own writing, not its heading
 * scaffold. Twelve rows reading "Bericht 29.08., 01:03 Uhr" over "Bearbeitet
 * Gestern, 22:54 Uhr" are twelve rows that differ only in a timestamp; the
 * letter's first sentence is what tells them apart.
 *
 * Headings are skipped: every untouched Bericht starts with "Diagnosen", so
 * leading with headings would rename them all to the same word.
 */
const AUTO_TITLE = /^Bericht \d{2}\.\d{2}\., \d{2}:\d{2} Uhr$/;

export function documentRowTitle(doc: DocumentRecord, limit = 70): string {
  // A title he typed himself always wins; the generated one never does.
  if (doc.title?.trim() && !AUTO_TITLE.test(doc.title.trim())) return doc.title.trim();

  const seen: string[] = [];
  const walk = (node: unknown): void => {
    if (seen.length > 0 || !node || typeof node !== 'object') return;
    const n = node as { type?: string; text?: string; content?: unknown[] };
    if (n.type === 'heading') return;
    if (typeof n.text === 'string' && n.text.trim()) {
      seen.push(n.text.trim());
      return;
    }
    for (const child of n.content ?? []) walk(child);
  };
  const root = doc.content as { content?: unknown[] } | null;
  for (const child of root?.content ?? []) walk(child);

  const line = seen[0];
  if (!line) return 'Noch leer';
  return line.length > limit ? `${line.slice(0, limit)}…` : line;
}

export async function createDocument(start: BerichtStart = 'vorlage'): Promise<DocumentRecord> {
  const now = Date.now();
  const record: DocumentRecord = {
    id: newId(),
    title: defaultDocumentTitle(now),
    content: start === 'leer' ? leererBerichtDoc() : templateContent(),
    createdAt: now,
    updatedAt: now,
  };
  await db.documents.add(record);
  return record;
}

export async function saveDocument(
  id: string,
  patch: Partial<Pick<DocumentRecord, 'title' | 'content' | 'previousContent'>>,
): Promise<void> {
  await db.documents
    .where('id')
    .equals(id)
    .modify((row) => {
      if (patch.title !== undefined) row.title = patch.title;
      if (patch.content !== undefined) row.content = patch.content;
      if (patch.previousContent !== undefined) row.previousContent = patch.previousContent;
      row.updatedAt = Date.now();
    });
}

/** Removes the Bericht and every dictation recorded into it. */
export async function deleteDocument(id: string): Promise<void> {
  const children = await db.sessions.filter((s) => s.parentId === id).toArray();
  for (const child of children) await deleteSession(child.id);
  await db.documents.delete(id);
}

/**
 * Fallback writer for a dictation that finished after its editor unmounted:
 * append the nodes to the stored TipTap JSON directly.
 */
export async function appendToDocument(id: string, nodes: unknown[]): Promise<void> {
  await db.documents
    .where('id')
    .equals(id)
    .modify((row) => {
      const content = row.content as { type: string; content?: unknown[] };
      if (content && content.type === 'doc') {
        content.content = [...(content.content ?? []), ...nodes];
        row.updatedAt = Date.now();
      }
    });
}

/**
 * Drop a Bericht that was created and then never used.
 *
 * Pressing "Bericht erstellen" and thinking better of it used to leave a blank
 * letter behind every time, so the list filled with identical empty documents
 * he then had to delete by hand. Leaving one now clears it away — but only
 * when it is untouched in every sense: still called what it was named at
 * birth, still exactly the shape it was born with — the bare template, or the
 * blank page — and nothing recorded into it. Any of those failing means there
 * is something of his in here, and it stays.
 *
 * Returns whether it was removed, so the caller can refresh its lists.
 */
export async function discardIfUntouched(id: string): Promise<boolean> {
  const row = await db.documents.get(id);
  if (!row) return false;
  if (row.title !== defaultDocumentTitle(row.createdAt)) return false;
  // Either shape a new Bericht can be born with, still untouched.
  if (!isTemplateBody(row.content) && !isEmptyBody(row.content)) return false;
  // A recording filed under it counts as use even when its text never landed.
  const recordings = await db.sessions.filter((s) => s.parentId === id).count();
  if (recordings > 0) return false;

  await db.documents.delete(id);
  return true;
}
