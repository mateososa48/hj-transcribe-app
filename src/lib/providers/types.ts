/**
 * Provider adapter contracts.
 *
 * These run BOTH in the browser (the app) and in Node 20+ (the eval harness).
 * Everything here must therefore stick to isomorphic APIs: fetch, Blob,
 * FormData, AbortSignal. No node:fs, no XMLHttpRequest, no SDK that assumes a
 * server. That constraint is deliberate — the eval must exercise the exact code
 * path that ships, or a green eval proves nothing about the app.
 */

/**
 * One entry, deliberately. The others were built, compared on German
 * cardiology audio, and removed once AssemblyAI won — see providers/index.ts.
 * The union stays a union so adding one back is a one-line change.
 */
export type TranscriptionProviderId = 'assemblyai-eu';

export interface TranscriptWord {
  text: string;
  startMs: number;
  endMs: number;
  confidence?: number;
}

export interface TranscriptChunk {
  /** Plain transcript text, as returned by the provider. */
  text: string;
  /** Speaker-separated turns, when diarization was requested and succeeded. */
  utterances?: TranscriptUtterance[];
  /** Word timings, when the provider supplies them. Used later for playback sync. */
  words?: TranscriptWord[];
  /** Wall-clock duration of the request, for the provider comparison table. */
  latencyMs: number;
  /** Raw provider payload. Kept for debugging; never persisted with patient data. */
  raw?: unknown;
}

export interface TranscribeOptions {
  language: 'de';
  /** Glossary terms: drug names, referring doctors, abbreviations. */
  keyterms: string[];
  /**
   * Speaker diarization. Off for dictations (one voice, and diarizing a solo
   * recording invites phantom second speakers); on for consultations, with the
   * realistic range for a consulting room.
   */
  diarize?: { minSpeakers: number; maxSpeakers: number };
  signal?: AbortSignal;
}

export interface TranscriptUtterance {
  /** Provider speaker label: "A", "B", … */
  speaker: string;
  text: string;
  startMs: number;
  endMs: number;
}

export interface TranscriptionProvider {
  readonly id: TranscriptionProviderId;
  readonly label: string;
  /** Whether the request stays inside the EU. Surfaced in Einstellungen. */
  readonly euHosted: boolean;
  /**
   * Transcribe one complete recording.
   *
   * The blob must be a valid container from its first byte — either a whole
   * MediaRecorder session's chunks concatenated in order, or any complete
   * audio file. A 30-minute consultation is one call; async providers upload
   * and poll internally.
   */
  transcribeFile(blob: Blob, opts: TranscribeOptions): Promise<TranscriptChunk>;
}

/** Providers are constructed with a key held in IndexedDB (app) or env (eval). */
export type TranscriptionProviderFactory = (apiKey: string) => TranscriptionProvider;

/** Thrown with the provider's own error body attached, so failures are debuggable. */
export class ProviderError extends Error {
  constructor(
    readonly providerId: TranscriptionProviderId,
    readonly status: number | undefined,
    message: string,
    readonly body?: string,
  ) {
    super(message);
    this.name = 'ProviderError';
  }
}

export async function assertOk(
  res: Response,
  providerId: TranscriptionProviderId,
): Promise<Response> {
  if (res.ok) return res;
  let body: string | undefined;
  try {
    body = await res.text();
  } catch {
    body = undefined;
  }
  throw new ProviderError(
    providerId,
    res.status,
    `${providerId}: HTTP ${res.status} ${res.statusText}`,
    body,
  );
}
