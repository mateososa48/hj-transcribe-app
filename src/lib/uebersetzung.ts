import {
  applySegments,
  collectSegments,
  translatedTitle,
  untranslatedCount,
} from '@/features/document/translate.ts';
import { db, newId, type DocumentRecord } from '@/lib/db.ts';
import { resolveDraftProvider } from '@/lib/generate.ts';
import { DraftError } from '@/lib/providers/index.ts';
import type { TranslationLanguage } from '../../prompts/uebersetzung.ts';

/**
 * Translating a Bericht into a second Bericht.
 *
 * The original is opened, read, and left exactly as it was: the translation is
 * a NEW document beside it in the list. Nothing he wrote can be lost to a
 * translation, and both letters export to Word independently.
 */

export interface TranslationOutcome {
  document: DocumentRecord;
  /** Blocks that came back in German — 0 on a clean run. */
  untranslated: number;
  /** Blocks sent, for the same reason. */
  total: number;
}

export async function translateDocument(
  documentId: string,
  language: TranslationLanguage,
  signal?: AbortSignal,
): Promise<TranslationOutcome> {
  const source = await db.documents.get(documentId);
  if (!source) throw new Error('Diesen Bericht gibt es nicht mehr.');

  const segments = collectSegments(source.content);
  if (segments.length === 0) {
    throw new DraftError('anthropic', 'Dieser Bericht enthält noch keinen Text zum Übersetzen.');
  }

  const provider = await resolveDraftProvider();
  if (!provider) {
    throw new DraftError(
      'anthropic',
      'Für die Übersetzung ist kein Zugang hinterlegt. Bitte geben Sie Bescheid.',
    );
  }

  const response = await provider.translateBericht({
    segments,
    language,
    ...(signal ? { signal } : {}),
  });

  const content = applySegments(source.content, response.segments);
  const now = Date.now();
  const record: DocumentRecord = {
    id: newId(),
    title: translatedTitle(source.title, language.endonym),
    content,
    createdAt: now,
    updatedAt: now,
  };
  await db.documents.add(record);

  return {
    document: record,
    untranslated: untranslatedCount(response.segments),
    total: segments.length,
  };
}
