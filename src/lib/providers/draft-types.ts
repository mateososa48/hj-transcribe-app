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
  vorbrief?: string;
  glossary: string[];
  examples: BeurteilungExample[];
  signal?: AbortSignal;
}

export interface GespraechRequest {
  transcript: string;
  vorbrief?: string;
  glossary: string[];
  signal?: AbortSignal;
}

interface DraftMeta {
  /** False when the model did not honour the output contract. */
  wellFormed: boolean;
  /** [FEHLT: …] markers found, for the review checklist. */
  fehlt: string[];
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

/** The dictation feature: one section. */
export interface BeurteilungResponse extends DraftMeta {
  text: string;
}

/** The consultation feature: three sections from one pass. */
export interface GespraechResponse extends DraftMeta {
  sections: Record<GespraechSection, string>;
}

export interface DraftProvider {
  readonly id: DraftProviderId;
  readonly label: string;
  readonly euHosted: boolean;
  draftBeurteilung(request: BeurteilungRequest): Promise<BeurteilungResponse>;
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
