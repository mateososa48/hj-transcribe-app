import type { BeurteilungExample } from '../../../prompts/examples/dev/index.ts';

/**
 * Drafting provider contract.
 *
 * `verify()` from the SPEC interface is deliberately absent until P4 builds the
 * verification pass — declaring a method nobody implements just produces stubs
 * that throw. It lands here when there is something real behind it.
 */

/**
 * `gateway` is the Vercel AI Gateway — a proxy, kept for model comparison only.
 * See gateway-draft.ts for why it must not ship to HJ as-is.
 */
export type DraftProviderId = 'anthropic' | 'mistral' | 'gateway';

export interface DraftRequest {
  transcript: string;
  vorbrief?: string;
  glossary: string[];
  examples: BeurteilungExample[];
  signal?: AbortSignal;
}

export interface DraftResponse {
  /** The parsed Beurteilung section. */
  text: string;
  /** False when the model did not honour the output contract. */
  wellFormed: boolean;
  /** [FEHLT: …] markers found in the draft. */
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

export interface DraftProvider {
  readonly id: DraftProviderId;
  readonly label: string;
  readonly euHosted: boolean;
  draftBeurteilung(request: DraftRequest): Promise<DraftResponse>;
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
