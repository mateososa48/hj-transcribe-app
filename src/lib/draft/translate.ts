import { TARGET_LANGUAGES, type TargetLanguage } from '../../../prompts/translate.ts';
import { db, logAudit, type TranslationRecord } from '@/lib/db.ts';
import { DraftError } from '@/lib/providers/index.ts';
import { resolveDraftProvider } from './generate.ts';

export { TARGET_LANGUAGES, type TargetLanguage };

export interface TranslateResult {
  record: TranslationRecord;
  /** True when everything that must be copied verbatim survived. */
  verified: boolean;
}

/**
 * Translate a document's Beurteilung and store the result.
 *
 * The structural check is deliberately run and PERSISTED rather than just
 * shown once: a translation that dropped a dose looks perfectly fluent, so the
 * warning has to survive as long as the translation does.
 */
export async function translateBeurteilung(
  documentId: string,
  languageCode: string,
  options: { signal?: AbortSignal } = {},
): Promise<TranslateResult> {
  const target = TARGET_LANGUAGES.find((l) => l.code === languageCode);
  if (!target) throw new DraftError('gateway', `Unbekannte Sprache: ${languageCode}`);

  const doc = await db.documents.get(documentId);
  if (!doc) throw new DraftError('gateway', 'Der Brief wurde nicht gefunden.');

  const source = doc.sections.beurteilung.trim();
  if (!source) {
    throw new DraftError('gateway', 'Es gibt noch keinen Text, der übersetzt werden könnte.');
  }

  const provider = await resolveDraftProvider();
  if (!provider) {
    throw new DraftError(
      'gateway',
      'Für die Übersetzung ist kein Zugangsschlüssel hinterlegt. Bitte in den Einstellungen ergänzen.',
    );
  }

  const response = await provider.translate({
    text: source,
    target,
    ...(options.signal ? { signal: options.signal } : {}),
  });

  const record: TranslationRecord = {
    text: response.text,
    missingNumbers: response.check.missingNumbers,
    missingDosing: response.check.missingDosing,
    createdAt: Date.now(),
    model: response.model,
  };

  await db.documents.update(documentId, {
    translations: { ...(doc.translations ?? {}), [languageCode]: record },
    updatedAt: Date.now(),
  });
  await logAudit('draft.translated', {
    documentId,
    detail: `${languageCode}/${response.model}${response.check.ok ? '' : ' (Prüfung offen)'}`,
  });

  return { record, verified: response.check.ok };
}
