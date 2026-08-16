import {
  assertOk,
  type TranscriptChunk,
  type TranscriptionProvider,
} from './types.ts';

/**
 * Mistral Voxtral. EU company, Paris-hosted inference.
 *
 * Browser-direct CORS verified 2026-08-15 against api.mistral.ai:
 *   access-control-allow-origin: *
 *   access-control-allow-headers: Authorization, Content-Type, ...
 *
 * OpenAI-compatible transcription shape.
 */
const ENDPOINT = 'https://api.mistral.ai/v1/audio/transcriptions';
const ID = 'voxtral' as const;

const MODEL = 'voxtral-mini-latest';

interface TranscriptionResponse {
  text?: string;
  language?: string;
}

export function createVoxtral(apiKey: string): TranscriptionProvider {
  return {
    id: ID,
    label: 'Mistral Voxtral',
    euHosted: true,

    async transcribeSegment(blob, opts): Promise<TranscriptChunk> {
      const started = Date.now();

      const form = new FormData();
      form.append('file', blob, 'segment.wav');
      form.append('model', MODEL);
      form.append('language', opts.language);

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
