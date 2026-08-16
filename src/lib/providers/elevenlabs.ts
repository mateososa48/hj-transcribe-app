import {
  assertOk,
  type TranscriptChunk,
  type TranscriptionProvider,
} from './types.ts';

/**
 * ElevenLabs Scribe.
 *
 * Browser-direct CORS verified 2026-08-15 against api.elevenlabs.io:
 *   access-control-allow-origin: *
 *   access-control-allow-headers: *
 *
 * NOT EU-hosted by default — flagged so Einstellungen can warn, and so the
 * EU-only policy decision (SPEC constraint 2) is enforceable in the UI rather
 * than only in a comment.
 */
const ENDPOINT = 'https://api.elevenlabs.io/v1/speech-to-text';
const ID = 'elevenlabs' as const;

/** Override if the account is provisioned for a newer Scribe revision. */
const MODEL_ID = 'scribe_v1';

interface ScribeResponse {
  text?: string;
  language_code?: string;
  words?: Array<{ text: string; start?: number; end?: number }> | null;
}

export function createElevenLabs(apiKey: string): TranscriptionProvider {
  return {
    id: ID,
    label: 'ElevenLabs Scribe',
    euHosted: false,

    async transcribeSegment(blob, opts): Promise<TranscriptChunk> {
      const started = Date.now();

      const form = new FormData();
      form.append('file', blob, 'segment.wav');
      form.append('model_id', MODEL_ID);
      form.append('language_code', opts.language);

      const res = await assertOk(
        await fetch(ENDPOINT, {
          method: 'POST',
          headers: { 'xi-api-key': apiKey },
          body: form,
          ...(opts.signal ? { signal: opts.signal } : {}),
        }),
        ID,
      );
      const json = (await res.json()) as ScribeResponse;

      return {
        text: json.text ?? '',
        ...(json.words
          ? {
              words: json.words.map((w) => ({
                text: w.text,
                startMs: Math.round((w.start ?? 0) * 1000),
                endMs: Math.round((w.end ?? 0) * 1000),
              })),
            }
          : {}),
        latencyMs: Date.now() - started,
        raw: json,
      };
    },
  };
}
