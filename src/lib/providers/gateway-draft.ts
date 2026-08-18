import {
  BEURTEILUNG_PROMPT_VERSION,
  buildStableSystemPrompt,
  buildUserPrompt,
  extractFehltMarkers,
  parseBeurteilung,
} from '../../../prompts/beurteilung.ts';
import {
  GESPRAECH_PROMPT_VERSION,
  buildGespraechSystemPrompt,
  buildGespraechUserPrompt,
  parseGespraech,
} from '../../../prompts/gespraech.ts';
import type {
  BeurteilungRequest,
  BeurteilungResponse,
  DraftProvider,
  GespraechRequest,
  GespraechResponse,
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
 * winning model should be called DIRECTLY through the Anthropic adapter —
 * already built — and this provider disabled before HJ ever records a real
 * patient.
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
  { id: 'openai/gpt-5.6-terra', label: 'GPT-5.6 Terra', euCapable: false },
  { id: 'openai/gpt-5.6-terra-fast', label: 'GPT-5.6 Terra (fast)', euCapable: false },
  { id: 'anthropic/claude-opus-5', label: 'Claude Opus 5', euCapable: false },
  { id: 'anthropic/claude-sonnet-5', label: 'Claude Sonnet 5', euCapable: false },
  { id: 'google/gemini-2.5-pro', label: 'Gemini 2.5 Pro', euCapable: false },
  { id: 'mistral/mistral-large-3', label: 'Mistral Large 3 (EU-Modell)', euCapable: true },
] as const;

/**
 * Verified present in the gateway's own model list on 2026-08-17 — the id is
 * `gpt-5.6-terra`, not `terra-5.6`, and a wrong id fails as an opaque runtime
 * error rather than a build error.
 */
export const DEFAULT_GATEWAY_MODEL = 'openai/gpt-5.6-terra';

export function createGatewayDraft(apiKey: string, model = DEFAULT_GATEWAY_MODEL): DraftProvider {
  return {
    id: 'gateway',
    label: `AI Gateway (${model})`,
    euHosted: false,

    async draftBeurteilung(request: BeurteilungRequest): Promise<BeurteilungResponse> {
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

    async draftGespraech(request: GespraechRequest): Promise<GespraechResponse> {
      const started = Date.now();
      const result = await chatCompletion({
        endpoint: ENDPOINT,
        apiKey,
        model,
        providerId: 'gateway',
        system: buildGespraechSystemPrompt(request.glossary),
        user: buildGespraechUserPrompt(request),
        ...(request.signal ? { signal: request.signal } : {}),
      });

      const { sections, wellFormed } = parseGespraech(result.raw);
      return {
        sections,
        wellFormed,
        fehlt: extractFehltMarkers(Object.values(sections).join('\n')),
        model: result.model,
        promptVersion: GESPRAECH_PROMPT_VERSION,
        latencyMs: Date.now() - started,
        ...(result.usage ? { usage: result.usage } : {}),
      };
    },
  };
}
