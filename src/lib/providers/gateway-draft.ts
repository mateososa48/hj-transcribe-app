import {
  BEURTEILUNG_PROMPT_VERSION,
  buildStableSystemPrompt,
  buildUserPrompt,
  extractFehltMarkers,
  parseBeurteilung,
} from '../../../prompts/beurteilung.ts';
import {
  buildTranslationSystemPrompt,
  buildTranslationUserPrompt,
  checkTranslation,
  parseTranslation,
} from '../../../prompts/translate.ts';
import type {
  DraftProvider,
  DraftRequest,
  DraftResponse,
  TranslateRequest,
  TranslateResponse,
} from './draft-types.ts';
import { chatCompletion } from './openai-compatible.ts';

/**
 * Vercel AI Gateway — a MODEL-SELECTION tool, not the production path.
 *
 * ⚠️ SPEC constraint 1 says: "No backend. No database server. NO PROXY. All API
 * calls go browser → provider directly." A gateway is by definition a proxy:
 * patient text travels browser → Vercel (US) → model provider. That inserts a
 * third processor into the data path, needs its own DPA, and contradicts the
 * constraint the whole architecture was built around.
 *
 * It earns its place for exactly one job: trying many models behind one key to
 * find which writes the best German cardiology prose. Once that is settled, the
 * winning model should be called DIRECTLY through the Anthropic or Mistral
 * adapter — both already built — and this provider disabled before HJ ever
 * records a real patient.
 *
 * Browser-direct CORS verified 2026-08-16 (echoes request origin).
 */

const ENDPOINT = 'https://ai-gateway.vercel.sh/v1/chat/completions';

/**
 * Curated shortlist for the comparison. The gateway exposes 300+ models; these
 * are the ones plausibly good at long-form clinical German. `euCapable`
 * describes the MODEL's own residency — the gateway hop is US regardless.
 */
export const GATEWAY_MODELS = [
  { id: 'anthropic/claude-sonnet-5', label: 'Claude Sonnet 5', euCapable: false },
  { id: 'anthropic/claude-opus-5', label: 'Claude Opus 5', euCapable: false },
  { id: 'anthropic/claude-opus-4.8', label: 'Claude Opus 4.8', euCapable: false },
  { id: 'openai/gpt-5.2', label: 'GPT-5.2', euCapable: false },
  { id: 'openai/gpt-5.4', label: 'GPT-5.4', euCapable: false },
  { id: 'google/gemini-2.5-pro', label: 'Gemini 2.5 Pro', euCapable: false },
  { id: 'mistral/mistral-large-3', label: 'Mistral Large 3 (EU-Modell)', euCapable: true },
  { id: 'mistral/mistral-medium-3.5', label: 'Mistral Medium 3.5 (EU-Modell)', euCapable: true },
] as const;

export const DEFAULT_GATEWAY_MODEL = 'anthropic/claude-sonnet-5';

export function createGatewayDraft(apiKey: string, model = DEFAULT_GATEWAY_MODEL): DraftProvider {
  return {
    id: 'gateway',
    label: `AI Gateway (${model})`,
    euHosted: false,

    async draftBeurteilung(request: DraftRequest): Promise<DraftResponse> {
      const started = Date.now();
      const result = await chatCompletion({
        endpoint: ENDPOINT,
        apiKey,
        model,
        providerId: 'gateway',
        system: buildStableSystemPrompt(request.examples, request.glossary),
        user: buildUserPrompt(request),
        ...(request.signal ? { signal: request.signal } : {}),
      });

      const { text, wellFormed } = parseBeurteilung(result.raw);
      return {
        text,
        wellFormed,
        fehlt: extractFehltMarkers(text),
        model: result.model,
        promptVersion: BEURTEILUNG_PROMPT_VERSION,
        latencyMs: Date.now() - started,
        ...(result.usage ? { usage: result.usage } : {}),
      };
    },

    async translate(request: TranslateRequest): Promise<TranslateResponse> {
      const started = Date.now();
      const result = await chatCompletion({
        endpoint: ENDPOINT,
        apiKey,
        model,
        providerId: 'gateway',
        system: buildTranslationSystemPrompt(request.target),
        user: buildTranslationUserPrompt(request.text, request.target),
        ...(request.signal ? { signal: request.signal } : {}),
      });

      const { text, wellFormed } = parseTranslation(result.raw);
      return {
        text,
        wellFormed,
        check: checkTranslation(request.text, text),
        model: result.model,
        latencyMs: Date.now() - started,
      };
    },
  };
}
