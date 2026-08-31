import type { BeurteilungExample } from '../../../prompts/examples/dev/index.ts';
import type { GespraechSection } from '../../../prompts/gespraech.ts';

/**
 * Drafting provider contract — one method per feature.
 *
 * `gateway` is the Vercel AI Gateway, a proxy kept for model comparison only.
 * See gateway-draft.ts for why it must not ship to HJ as-is.
 */
export type DraftProviderId = 'anthropic' | 'gateway';

export interface BeurteilungRequest {
  transcript: string;
  glossary: string[];
  examples: BeurteilungExample[];
  signal?: AbortSignal;
}

export interface AbschnittRequest {
  transcript: string;
  glossary: string[];
  signal?: AbortSignal;
}

export interface GespraechRequest {
  /** Speaker-prefixed lines ("Arzt: …"), or plain text without diarization. */
  transcript: string;
  glossary: string[];
  signal?: AbortSignal;
}

interface DraftMeta {
  /** False when the model did not honour the output contract. */
  wellFormed: boolean;
  model: string;
  promptVersion: string;
  latencyMs: number;
  usage?: {
    inputTokens?: number;
    outputTokens?: number;
    cacheReadTokens?: number;
    cacheWriteTokens?: number;
  };
}

/**
 * The dictation feature: one section, and what the model judged it to be.
 * Usually "Zusammenfassende Beurteilung"; null when it would not say.
 */
export interface BeurteilungResponse extends DraftMeta {
  heading: string | null;
  text: string;
}

/** A dictated Bericht section: optional announced heading plus the text. */
export interface AbschnittResponse extends DraftMeta {
  heading: string | null;
  text: string;
}

/** The consultation feature: three sections from one pass. */
export interface GespraechResponse extends DraftMeta {
  /** Keyed by the model's own headings — not a fixed set any more. */
  sections: Record<string, string>;
  /** Reading order: object key order is not a contract. */
  order: string[];
  /** The heading the model chose, by key. */
  labels: Record<string, string>;
}

export interface DraftProvider {
  readonly id: DraftProviderId;
  readonly label: string;
  readonly euHosted: boolean;
  draftBeurteilung(request: BeurteilungRequest): Promise<BeurteilungResponse>;
  draftAbschnitt(request: AbschnittRequest): Promise<AbschnittResponse>;
  draftGespraech(request: GespraechRequest): Promise<GespraechResponse>;
}

/** `model` is only meaningful for multi-model providers (the gateway). */
export type DraftProviderFactory = (apiKey: string, model?: string) => DraftProvider;

export class DraftError extends Error {
  constructor(
    readonly providerId: DraftProviderId,
    message: string,
    readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'DraftError';
  }
}
