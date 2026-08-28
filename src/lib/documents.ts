import { db, newId, type DocumentRecord } from '@/lib/db.ts';
import { deleteSession } from '@/lib/generate.ts';

/**
 * Berichte: create, save, delete — and one guarantee that matters more than
 * the rest: a dictation that finishes after its editor closed is APPENDED to
 * the stored document instead of being dropped. Nothing he spoke is lost.
 */

/**
 * His letter template, as the editor's starting shape: the five sections his
 * real letters use, each an empty heading he fills by typing, dictating or
 * importing — partial by design, never a generated full report.
 */
export const BERICHT_TEMPLATE_SECTIONS = [
  'Diagnosen',
  'Anamnese',
  'Befunde',
  'Zusammenfassende Beurteilung',
  'Aktuelle Therapie',
] as const;

function templateContent(): unknown {
  return {
    type: 'doc',
    content: [
      // Kopf/Anrede space above the first section.
      { type: 'paragraph' },
      ...BERICHT_TEMPLATE_SECTIONS.flatMap((title) => [
        { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: title }] },
        { type: 'paragraph' },
      ]),
    ],
  };
}

export async function createDocument(): Promise<DocumentRecord> {
  const now = Date.now();
  const when = new Date(now);
  const day = when.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
  const time = when.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
  const record: DocumentRecord = {
    id: newId(),
    title: `Bericht ${day}, ${time} Uhr`,
    content: templateContent(),
    createdAt: now,
    updatedAt: now,
  };
  await db.documents.add(record);
  return record;
}

export async function saveDocument(
  id: string,
  patch: Partial<Pick<DocumentRecord, 'title' | 'content'>>,
): Promise<void> {
  await db.documents
    .where('id')
    .equals(id)
    .modify((row) => {
      if (patch.title !== undefined) row.title = patch.title;
      if (patch.content !== undefined) row.content = patch.content;
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
