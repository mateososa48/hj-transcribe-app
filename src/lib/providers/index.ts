import { createAnthropicDraft } from './anthropic-draft.ts';
import { createAssemblyAI } from './assemblyai.ts';
import type { DraftProviderFactory, DraftProviderId } from './draft-types.ts';
import { createElevenLabs } from './elevenlabs.ts';
import { createGatewayDraft } from './gateway-draft.ts';
import { createMistralDraft } from './mistral-draft.ts';
import { createOpenAI } from './openai.ts';
import type { TranscriptionProviderFactory, TranscriptionProviderId } from './types.ts';
import { createVoxtral } from './voxtral.ts';

export * from './types.ts';

/**
 * Registry of usable ASR providers.
 *
 * Corti is deliberately absent. Its data-plane host (api.eu.corti.app) does send
 * permissive CORS headers, but its Keycloak token endpoint (auth.corti.app)
 * returned no preflight response at all on 2026-08-15 — meaning a browser can
 * never mint the token in the first place. Under SPEC constraint 1 ("any
 * provider that requires server-side token minting is out") that disqualifies
 * it. Re-test with a real tenant before writing it off permanently; if the
 * token endpoint turns out to be CORS-enabled, add the adapter here.
 */
export const TRANSCRIPTION_PROVIDERS: Record<
  Exclude<TranscriptionProviderId, 'corti'>,
  TranscriptionProviderFactory
> = {
  'assemblyai-eu': createAssemblyAI,
  elevenlabs: createElevenLabs,
  voxtral: createVoxtral,
  openai: createOpenAI,
};

/** Env var each provider's key is read from by the eval harness. */
export const PROVIDER_ENV_KEYS: Record<Exclude<TranscriptionProviderId, 'corti'>, string> = {
  'assemblyai-eu': 'ASSEMBLYAI_API_KEY',
  elevenlabs: 'ELEVENLABS_API_KEY',
  voxtral: 'MISTRAL_API_KEY',
  openai: 'OPENAI_API_KEY',
};

/**
 * Display metadata for the settings UI.
 *
 * Separate from the factories so the UI can list providers without holding an
 * API key, and so `euHosted` is stated once rather than re-derived per screen.
 */
export interface ProviderMeta {
  label: string;
  euHosted: boolean;
  /** Where HJ gets the key, shown as help text. */
  keyHint: string;
}

export const ASR_PROVIDER_META: Record<Exclude<TranscriptionProviderId, 'corti'>, ProviderMeta> = {
  'assemblyai-eu': {
    label: 'AssemblyAI (EU)',
    euHosted: true,
    // Kein separates EU-Konto nötig: derselbe Schlüssel, die EU-Verarbeitung
    // ergibt sich aus der Basis-URL api.eu.assemblyai.com (AWS eu-west-1).
    keyHint: 'assemblyai.com — normaler Zugangsschlüssel, EU-Verarbeitung über die EU-Adresse',
  },
  voxtral: {
    label: 'Mistral Voxtral (EU)',
    euHosted: true,
    keyHint: 'console.mistral.ai',
  },
  elevenlabs: {
    label: 'ElevenLabs Scribe',
    euHosted: false,
    keyHint: 'elevenlabs.io',
  },
  openai: {
    label: 'OpenAI Whisper',
    euHosted: false,
    keyHint: 'platform.openai.com',
  },
};

export * from './draft-types.ts';

/** Drafting providers, keyed the same way as the ASR registry. */
export const DRAFT_PROVIDERS: Record<DraftProviderId, DraftProviderFactory> = {
  anthropic: createAnthropicDraft,
  mistral: createMistralDraft,
  gateway: (key, model) => createGatewayDraft(key, model),
};

export const LLM_PROVIDER_META = {
  anthropic: {
    label: 'Anthropic Claude',
    euHosted: false,
    keyHint: 'console.anthropic.com',
  },
  mistral: {
    label: 'Mistral (EU)',
    euHosted: true,
    keyHint: 'console.mistral.ai',
  },
  gateway: {
    label: 'AI Gateway (Modellvergleich)',
    euHosted: false,
    keyHint: 'vercel.com — nur zum Vergleich von Modellen, nicht für den Echtbetrieb',
  },
} as const satisfies Record<string, ProviderMeta>;

export { GATEWAY_MODELS, DEFAULT_GATEWAY_MODEL } from './gateway-draft.ts';
