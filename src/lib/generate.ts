import { loadExamples } from '../../prompts/examples/dev/index.ts';
import { db, newId, type Result, type SessionKind } from '@/lib/db.ts';
import { DRAFT_PROVIDERS, DraftError, type DraftProvider } from '@/lib/providers/index.ts';
import { loadApiKeys, loadSettings } from '@/lib/settings.ts';
import { assembleTranscript } from '@/lib/transcription/queue.ts';

/**
 * Recording -> text he can paste.
 *
 * Both features land here and produce the same thing: a `Result` holding one
 * section per block of his letter, plus an untouched copy of what the model
 * actually said. Only the prompt differs.
 */

export async function resolveDraftProvider(): Promise<DraftProvider | null> {
  const [settings, keys] = await Promise.all([loadSettings(), loadApiKeys()]);
  const factory = DRAFT_PROVIDERS[settings.llmProviderId];
  const key = keys[settings.llmProviderId];
  if (!factory || !key) return null;
  // The model is a constant, not a setting: with no picker in the UI, a value
  // left in his browser from an older build would quietly win over the default.
  return factory(key);
}

export interface GenerateResult {
  result: Result;
  /** Whether the few-shot examples were HJ's real letters or synthetic ones. */
  exampleSource: 'real' | 'dev';
  fehlt: string[];
  wellFormed: boolean;
  model: string;
  latencyMs: number;
}

export interface GenerateOptions {
  vorbrief?: string;
  signal?: AbortSignal;
}

export async function generate(
  sessionId: string,
  kind: SessionKind,
  options: GenerateOptions = {},
): Promise<GenerateResult> {
  const provider = await resolveDraftProvider();
  if (!provider) {
    throw new DraftError(
      'anthropic',
      'Für die Texterstellung ist kein Zugang hinterlegt. Bitte geben Sie Bescheid.',
    );
  }

  const transcript = await assembleTranscript(sessionId);
  if (!transcript.trim()) {
    throw new DraftError(
      provider.id,
      'Es liegt noch kein erkannter Text vor. Bitte warten Sie, bis die Übertragung abgeschlossen ist.',
    );
  }

  const { examples, source } = await loadExamples();
  const request = {
    transcript,
    glossary: [] as string[],
    ...(options.vorbrief ? { vorbrief: options.vorbrief } : {}),
    ...(options.signal ? { signal: options.signal } : {}),
  };

  const response =
    kind === 'gespraech'
      ? await provider.draftGespraech(request)
      : await provider.draftBeurteilung({ ...request, examples });

  const sections: Record<string, string> =
    'sections' in response ? { ...response.sections } : { beurteilung: response.text };

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
    // edits and what it said has to stay truthful, or the record is worse than
    // not keeping one.
    original: { ...sections },
    model: response.model,
    promptVersion: response.promptVersion,
    wellFormed: response.wellFormed,
    ...(options.vorbrief ? { vorbrief: options.vorbrief } : {}),
  };

  await db.results.put(result);
  await db.sessions.update(sessionId, { resultId: result.id });

  return {
    result,
    exampleSource: source,
    fehlt: response.fehlt,
    wellFormed: response.wellFormed,
    model: response.model,
    latencyMs: response.latencyMs,
  };
}

/** Autosaved as he types. */
export async function saveSection(
  resultId: string,
  section: string,
  text: string,
): Promise<void> {
  const result = await db.results.get(resultId);
  if (!result || result.sections[section] === text) return;
  await db.results.update(resultId, {
    sections: { ...result.sections, [section]: text },
    updatedAt: Date.now(),
  });
}

/** Deletes a recording, its audio, its transcripts and its text. */
export async function deleteSession(sessionId: string): Promise<void> {
  await Promise.all([
    db.segments.where('sessionId').equals(sessionId).delete(),
    db.transcripts.where('sessionId').equals(sessionId).delete(),
    db.results.where('sessionId').equals(sessionId).delete(),
    db.sessions.delete(sessionId),
  ]);
}
