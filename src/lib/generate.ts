import { loadExamples } from '../../prompts/examples/dev/index.ts';
import { db, newId, type Result, type SessionKind, type Utterance } from '@/lib/db.ts';
import { DRAFT_PROVIDERS, DraftError, type DraftProvider } from '@/lib/providers/index.ts';
import { loadApiKeys, loadSettings } from '@/lib/settings.ts';
import { BULLET_SECTIONS, toBulletText } from '@/lib/format.ts';
import { speakerDisplayName } from '@/lib/speakers.ts';

/**
 * Transcript -> text he can paste.
 *
 * Both features land here and produce the same thing: a `Result` holding one
 * section per block, plus an untouched copy of what the model actually said.
 * Only the prompt differs.
 */

export async function resolveDraftProvider(): Promise<DraftProvider | null> {
  const [settings, keys] = await Promise.all([loadSettings(), loadApiKeys()]);
  const factory = DRAFT_PROVIDERS[settings.llmProviderId];
  const key = keys[settings.llmProviderId];
  if (!factory || !key) return null;
  return factory(key);
}

/**
 * The conversation as the model should read it: one line per turn, prefixed
 * with the speaker's display name. Falls back to the plain text when
 * diarization produced nothing.
 */
export function renderTranscriptForPrompt(
  text: string,
  utterances: Utterance[],
  speakerNames: Record<string, string> | undefined,
): string {
  if (utterances.length === 0) return text;
  return utterances
    .map((u) => `${speakerDisplayName(u.speaker, speakerNames, utterances)}: ${u.text}`)
    .join('\n');
}

export interface GenerateResult {
  result: Result;
  wellFormed: boolean;
  model: string;
  latencyMs: number;
}

export async function generate(sessionId: string, kind: SessionKind): Promise<GenerateResult> {
  const provider = await resolveDraftProvider();
  if (!provider) {
    throw new DraftError(
      'anthropic',
      'Für die Texterstellung ist kein Zugang hinterlegt. Bitte geben Sie Bescheid.',
    );
  }

  const [session, transcription] = await Promise.all([
    db.sessions.get(sessionId),
    db.transcriptions.where('sessionId').equals(sessionId).first(),
  ]);
  if (!transcription?.text.trim()) {
    throw new DraftError(provider.id, 'Zu dieser Aufnahme liegt noch kein Transkript vor.');
  }

  const transcript =
    kind === 'gespraech'
      ? renderTranscriptForPrompt(
          transcription.text,
          transcription.utterances,
          session?.speakerNames,
        )
      : transcription.text;

  const response =
    kind === 'gespraech'
      ? await provider.draftGespraech({ transcript, glossary: [] })
      : await provider.draftBeurteilung({
          transcript,
          glossary: [],
          examples: (await loadExamples()).examples,
        });

  const sections: Record<string, string> =
    'sections' in response ? { ...response.sections } : { beurteilung: response.text };
  // List sections are stored the way a letter looks: real bullets, not the
  // model's "- " markers. Editing and copying then start from the right shape.
  for (const key of Object.keys(sections)) {
    if (BULLET_SECTIONS.has(key)) sections[key] = toBulletText(sections[key] ?? '');
  }

  const now = Date.now();
  const existing = await db.results.where('sessionId').equals(sessionId).first();
  const result: Result = {
    id: existing?.id ?? newId(),
    sessionId,
    kind,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
    sections,
    // Regenerating replaces the model's copy too — the pairing between what he
    // edits and what it said has to stay truthful.
    original: { ...sections },
    // Keep the text being replaced: his corrections may live in it, and
    // "regenerate ate my edits" must always be one click reversible.
    ...(existing ? { previousSections: { ...existing.sections } } : {}),
    model: response.model,
    promptVersion: response.promptVersion,
    wellFormed: response.wellFormed,
  };

  await db.results.put(result);
  await db.sessions.update(sessionId, { resultId: result.id });

  return {
    result,
    wellFormed: response.wellFormed,
    model: response.model,
    latencyMs: response.latencyMs,
  };
}

/** Bring back the working copy a regenerate replaced. One level, one shot. */
export async function restorePreviousSections(resultId: string): Promise<boolean> {
  let restored = false;
  await db.results
    .where('id')
    .equals(resultId)
    .modify((result) => {
      if (!result.previousSections) return;
      result.sections = result.previousSections;
      delete result.previousSections;
      result.updatedAt = Date.now();
      restored = true;
    });
  return restored;
}

/** Autosaved as he types. */
export async function saveSection(resultId: string, section: string, text: string): Promise<void> {
  const result = await db.results.get(resultId);
  if (!result || result.sections[section] === text) return;
  await db.results.update(resultId, {
    sections: { ...result.sections, [section]: text },
    updatedAt: Date.now(),
  });
}

/** Deletes a recording, its audio, its transcript and its text. */
export async function deleteSession(sessionId: string): Promise<void> {
  await Promise.all([
    db.chunks.where('sessionId').equals(sessionId).delete(),
    db.transcriptions.where('sessionId').equals(sessionId).delete(),
    db.results.where('sessionId').equals(sessionId).delete(),
    db.sessions.delete(sessionId),
  ]);
}
