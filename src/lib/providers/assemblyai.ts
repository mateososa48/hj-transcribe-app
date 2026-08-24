import {
  assertOk,
  ProviderError,
  type TranscriptChunk,
  type TranscriptionProvider,
} from './types.ts';

/**
 * AssemblyAI, EU region.
 *
 * Browser-direct CORS verified 2026-08-15 against api.eu.assemblyai.com:
 *   access-control-allow-origin: *
 *   access-control-allow-headers: Content-Type, Authorization, X-Requested-With, ...
 * Auth is a bare key in `Authorization` (no "Bearer " prefix).
 *
 * Three-step flow: upload bytes -> create transcript job -> poll until done.
 */
const BASE = 'https://api.eu.assemblyai.com';
const ID = 'assemblyai-eu' as const;

interface TranscriptResponse {
  id: string;
  status: 'queued' | 'processing' | 'completed' | 'error';
  text?: string | null;
  error?: string | null;
  words?: Array<{ text: string; start: number; end: number; confidence?: number }> | null;
  utterances?: Array<{ speaker: string; text: string; start: number; end: number }> | null;
}

export function createAssemblyAI(apiKey: string): TranscriptionProvider {
  const headers = { Authorization: apiKey };

  return {
    id: ID,
    label: 'AssemblyAI (EU)',
    euHosted: true,

    async transcribeFile(blob, opts): Promise<TranscriptChunk> {
      const started = Date.now();

      const uploadRes = await assertOk(
        await fetch(`${BASE}/v2/upload`, {
          method: 'POST',
          headers: { ...headers, 'Content-Type': 'application/octet-stream' },
          body: blob,
          ...(opts.signal ? { signal: opts.signal } : {}),
        }),
        ID,
      );
      const { upload_url } = (await uploadRes.json()) as { upload_url: string };

      const createRes = await assertOk(
        await fetch(`${BASE}/v2/transcript`, {
          method: 'POST',
          headers: { ...headers, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            audio_url: upload_url,
            language_code: opts.language,
            // Domain bias. `keyterms_prompt` is the current parameter for the
            // Universal models (up to 1000 terms); it replaced word_boost.
            // If the API rejects it, the eval surfaces the 400 body.
            ...(opts.keyterms.length ? { keyterms_prompt: opts.keyterms } : {}),
            // Diarization: consultations only. speaker_options describes the
            // realistic range rather than pinning an exact count — the docs
            // recommend the range form unless the count is certain.
            ...(opts.diarize
              ? {
                  speaker_labels: true,
                  speaker_options: {
                    min_speakers_expected: opts.diarize.minSpeakers,
                    max_speakers_expected: opts.diarize.maxSpeakers,
                  },
                }
              : {}),
          }),
          ...(opts.signal ? { signal: opts.signal } : {}),
        }),
        ID,
      );
      const created = (await createRes.json()) as TranscriptResponse;

      // Poll. A full consultation is a real job: allow up to 15 min, check
      // every 3 s. Universal typically finishes a 20-min file well under a
      // minute, so the deadline is a hang-guard, not the expectation.
      const deadline = Date.now() + 15 * 60_000;
      for (;;) {
        if (Date.now() > deadline) {
          throw new ProviderError(ID, undefined, 'assemblyai-eu: polling timed out after 15 min');
        }
        await new Promise((r) => setTimeout(r, 3_000));

        const pollRes = await assertOk(
          await fetch(`${BASE}/v2/transcript/${created.id}`, {
            headers,
            ...(opts.signal ? { signal: opts.signal } : {}),
          }),
          ID,
        );
        const job = (await pollRes.json()) as TranscriptResponse;

        if (job.status === 'error') {
          throw new ProviderError(ID, undefined, `assemblyai-eu: ${job.error ?? 'unknown error'}`);
        }
        if (job.status === 'completed') {
          return {
            text: job.text ?? '',
            ...(job.utterances && job.utterances.length
              ? {
                  utterances: job.utterances.map((u) => ({
                    speaker: u.speaker,
                    text: u.text,
                    startMs: u.start,
                    endMs: u.end,
                  })),
                }
              : {}),
            ...(job.words
              ? {
                  words: job.words.map((w) => ({
                    text: w.text,
                    startMs: w.start,
                    endMs: w.end,
                    ...(w.confidence !== undefined ? { confidence: w.confidence } : {}),
                  })),
                }
              : {}),
            latencyMs: Date.now() - started,
            raw: job,
          };
        }
      }
    },
  };
}
