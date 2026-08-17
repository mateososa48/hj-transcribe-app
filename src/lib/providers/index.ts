import { createAnthropicDraft } from './anthropic-draft.ts';
import { createAssemblyAI } from './assemblyai.ts';
import type { DraftProviderFactory, DraftProviderId } from './draft-types.ts';
import { createGatewayDraft } from './gateway-draft.ts';
import type { TranscriptionProviderFactory, TranscriptionProviderId } from './types.ts';

export * from './types.ts';
export * from './draft-types.ts';

/**
 * Registry of usable providers — deliberately short.
 *
 * He has one machine, one key pair, and no way to choose between adapters, so
 * every extra entry was a settings row he could get wrong and an origin in the
 * CSP that nothing calls. ElevenLabs, Whisper, Voxtral and the direct Mistral
 * adapter were built, compared, and removed once AssemblyAI won the German
 * evaluation; they are one `git revert` away if that changes.
 *
 * Corti is absent for a harder reason. Its data plane (api.eu.corti.app) sends
 * permissive CORS headers, but its Keycloak token endpoint (auth.corti.app)
 * returned no preflight response at all on 2026-08-15 — a browser can never
 * mint the token. Under SPEC constraint 1 that disqualifies it outright.
 */
export const TRANSCRIPTION_PROVIDERS: Record<
  Extract<TranscriptionProviderId, 'assemblyai-eu'>,
  TranscriptionProviderFactory
> = {
  'assemblyai-eu': createAssemblyAI,
};

/** Env var the eval harness reads each key from. */
export const PROVIDER_ENV_KEYS = {
  'assemblyai-eu': 'ASSEMBLYAI_API_KEY',
} as const;

export interface ProviderMeta {
  label: string;
  euHosted: boolean;
}

export const ASR_PROVIDER_META = {
  'assemblyai-eu': {
    label: 'AssemblyAI (EU)',
    // Kein separates EU-Konto nötig: derselbe Schlüssel, die EU-Verarbeitung
    // ergibt sich aus der Basis-URL api.eu.assemblyai.com (AWS eu-west-1).
    euHosted: true,
  },
} as const satisfies Record<string, ProviderMeta>;

/** Drafting providers, keyed the same way. */
export const DRAFT_PROVIDERS: Record<DraftProviderId, DraftProviderFactory> = {
  anthropic: createAnthropicDraft,
  gateway: (key, model) => createGatewayDraft(key, model),
};

export const LLM_PROVIDER_META = {
  anthropic: { label: 'Anthropic Claude', euHosted: false },
  gateway: { label: 'AI Gateway (Modellvergleich)', euHosted: false },
} as const satisfies Record<DraftProviderId, ProviderMeta>;

export { GATEWAY_MODELS, DEFAULT_GATEWAY_MODEL } from './gateway-draft.ts';
