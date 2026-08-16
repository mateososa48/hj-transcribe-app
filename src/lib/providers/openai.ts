import {
  assertOk,
  type TranscriptChunk,
  type TranscriptionProvider,
} from './types.ts';

/**
 * OpenAI transcription — BASELINE FOR THE EVAL ONLY.
 *
 * Browser-direct CORS verified 2026-08-15 against api.openai.com (echoes the
 * request origin), so it is technically shippable. But it is a US endpoint, so
 * under SPEC constraint 2 it must not be selectable for patient audio unless
 * the EU-only rule is explicitly relaxed. It exists here to give the trap-set
 * eval a well-understood reference score — if the EU providers land within a
 * few points of it, the EU constraint costs nothing.
 */
const ENDPOINT = 'https://api.openai.com/v1/audio/transcriptions';
const ID = 'openai' as const;

const MODEL = 'whisper-1';

interface TranscriptionResponse {
  text?: string;
}

export function createOpenAI(apiKey: string): TranscriptionProvider {
  return {
    id: ID,
    label: 'OpenAI Whisper (baseline, US)',
    euHosted: false,

    async transcribeSegment(blob, opts): Promise<TranscriptChunk> {
      const started = Date.now();

      const form = new FormData();
      form.append('file', blob, 'segment.wav');
      form.append('model', MODEL);
      form.append('language', opts.language);
      // Whisper takes glossary bias as a free-text prompt rather than a list.
      if (opts.keyterms.length) {
        form.append('prompt', opts.keyterms.join(', '));
      }

      const res = await assertOk(
        await fetch(ENDPOINT, {
          method: 'POST',
          headers: { Authorization: `Bearer ${apiKey}` },
          body: form,
          ...(opts.signal ? { signal: opts.signal } : {}),
        }),
        ID,
      );
      const json = (await res.json()) as TranscriptionResponse;

      return {
        text: json.text ?? '',
        latencyMs: Date.now() - started,
        raw: json,
      };
    },
  };
}
