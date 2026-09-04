import {
  ABSCHNITT_PROMPT_VERSION,
  buildAbschnittSystemPrompt,
  buildAbschnittUserPrompt,
  parseAbschnitt,
} from '../../../prompts/abschnitt.ts';
import {
  BEURTEILUNG_PROMPT_VERSION,
  buildStableSystemPrompt,
  buildUserPrompt,
  parseBeurteilung,
} from '../../../prompts/beurteilung.ts';
import {
  GESPRAECH_PROMPT_VERSION,
  buildGespraechSystemPrompt,
  buildGespraechUserPrompt,
  parseGespraech,
} from '../../../prompts/gespraech.ts';
import {
  buildUebersetzungSystemPrompt,
  buildUebersetzungUserPrompt,
  parseUebersetzung,
  UEBERSETZUNG_PROMPT_VERSION,
} from '../../../prompts/uebersetzung.ts';
import type {
  AbschnittRequest,
  AbschnittResponse,
  BeurteilungRequest,
  BeurteilungResponse,
  DraftProvider,
  GespraechRequest,
  GespraechResponse,
  UebersetzungRequest,
  UebersetzungResponse,
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
  { id: 'openai/gpt-5.6-terra-fast', label: 'GPT-5.6 Terra (fast)', euCapable: false },
  { id: 'openai/gpt-5.6-terra', label: 'GPT-5.6 Terra', euCapable: false },
  { id: 'openai/gpt-5.6-luna-fast', label: 'GPT-5.6 Luna (fast)', euCapable: false },
  { id: 'openai/gpt-5.6-luna', label: 'GPT-5.6 Luna', euCapable: false },
  { id: 'anthropic/claude-opus-5', label: 'Claude Opus 5', euCapable: false },
  { id: 'anthropic/claude-sonnet-5', label: 'Claude Sonnet 5', euCapable: false },
  { id: 'google/gemini-2.5-pro', label: 'Gemini 2.5 Pro', euCapable: false },
  { id: 'mistral/mistral-large-3', label: 'Mistral Large 3 (EU-Modell)', euCapable: true },
] as const;

/**
 * All four ids re-verified against the gateway's own model list on 2026-09-04.
 * The order is `gpt-5.6-terra`, not `terra-5.6`; a wrong id fails as an opaque
 * runtime error rather than a build error, so check before changing this.
 *
 * The default is the `-fast` variant. Measured the same day on the real
 * Abschnitt prompt (7,895-character system prompt, two runs each), best of:
 * terra 2.3 s, terra-fast 2.2 s, luna 1.8 s, luna-fast 1.2 s. All four
 * returned well-formed German of the same length. The spread between models is
 * smaller than the spread between runs of one model, so this is not a
 * measured win over terra so much as a free one — and Luna is unproven on the
 * medical prompts, which is why it is offered but not the default.
 */
export const DEFAULT_GATEWAY_MODEL = 'openai/gpt-5.6-terra-fast';

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

      const { heading, text, wellFormed } = parseBeurteilung(result.raw);
      return {
        heading,
        text,
        wellFormed,
        model: result.model,
        promptVersion: BEURTEILUNG_PROMPT_VERSION,
        latencyMs: Date.now() - started,
        ...(result.usage ? { usage: result.usage } : {}),
      };
    },

    async draftAbschnitt(request: AbschnittRequest): Promise<AbschnittResponse> {
      const started = Date.now();
      const result = await chatCompletion({
        endpoint: ENDPOINT,
        apiKey,
        model,
        providerId: 'gateway',
        system: buildAbschnittSystemPrompt(request.glossary),
        user: buildAbschnittUserPrompt(request),
        ...(request.signal ? { signal: request.signal } : {}),
      });
      const { heading, text, wellFormed } = parseAbschnitt(result.raw);
      return {
        heading,
        text,
        wellFormed,
        model: result.model,
        promptVersion: ABSCHNITT_PROMPT_VERSION,
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

      const { sections, order, labels, wellFormed } = parseGespraech(result.raw);
      return {
        sections,
        order,
        labels,
        wellFormed,
        model: result.model,
        promptVersion: GESPRAECH_PROMPT_VERSION,
        latencyMs: Date.now() - started,
        ...(result.usage ? { usage: result.usage } : {}),
      };
    },

    async translateBericht(request: UebersetzungRequest): Promise<UebersetzungResponse> {
      const started = Date.now();
      const result = await chatCompletion({
        endpoint: ENDPOINT,
        apiKey,
        model,
        providerId: 'gateway',
        system: buildUebersetzungSystemPrompt(request.language),
        user: buildUebersetzungUserPrompt(request.segments),
        // A whole letter comes back; the helper's default would truncate it.
        maxTokens: 32_000,
        ...(request.signal ? { signal: request.signal } : {}),
      });

      const { segments, wellFormed } = parseUebersetzung(result.raw, request.segments.length);
      return {
        segments,
        wellFormed,
        model: result.model,
        promptVersion: UEBERSETZUNG_PROMPT_VERSION,
        latencyMs: Date.now() - started,
        ...(result.usage ? { usage: result.usage } : {}),
      };
    },
  };
}
