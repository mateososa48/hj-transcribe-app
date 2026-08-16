import {
  BEURTEILUNG_PROMPT_VERSION,
  buildStableSystemPrompt,
  buildUserPrompt,
  extractFehltMarkers,
  parseBeurteilung,
} from '../../../prompts/beurteilung.ts';
import { DraftError, type DraftProvider, type DraftRequest, type DraftResponse } from './draft-types.ts';

/**
 * Vercel AI Gateway — a MODEL-SELECTION tool, not the production path.
 *
 * ⚠️ SPEC constraint 1 says: "No backend. No database server. NO PROXY. All API
 * calls go browser → provider directly." A gateway is by definition a proxy:
 * patient text travels browser → Vercel (US) → model provider. That inserts a
 * third processor into the data path, needs its own DPA, and contradicts the
 * constraint the whole architecture was built around.
 *
 * It earns its place for exactly one job: trying 327 models behind one key to
 * find which writes the best German cardiology prose. Once that question is
 * settled, the winning model should be called DIRECTLY through the Anthropic or
 * Mistral adapter — both already built — and this provider disabled before HJ
 * ever records a real patient.
 *
 * Browser-direct CORS verified 2026-08-16 (echoes request origin).
 */

const ENDPOINT = 'https://ai-gateway.vercel.sh/v1/chat/completions';

/**
 * Curated shortlist for the comparison. The gateway exposes 327 models; these
 * are the ones plausibly good at long-form clinical German. `euHosted` here
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

interface ChatResponse {
  model?: string;
  choices?: Array<{ message?: { content?: string }; finish_reason?: string }>;
  usage?: { prompt_tokens?: number; completion_tokens?: number };
  error?: { message?: string };
}

export function createGatewayDraft(apiKey: string, model = DEFAULT_GATEWAY_MODEL): DraftProvider {
  return {
    id: 'gateway',
    label: `AI Gateway (${model})`,
    euHosted: false,

    async draftBeurteilung(request: DraftRequest): Promise<DraftResponse> {
      const started = Date.now();
      const system = buildStableSystemPrompt(request.examples, request.glossary);

      let response: Response;
      try {
        response = await fetch(ENDPOINT, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model,
            max_tokens: 4_000,
            messages: [
              { role: 'system', content: system },
              { role: 'user', content: buildUserPrompt(request) },
            ],
          }),
          ...(request.signal ? { signal: request.signal } : {}),
        });
      } catch (error) {
        throw new DraftError('gateway', 'Das AI Gateway ist nicht erreichbar.', error);
      }

      if (!response.ok) {
        const body = await response.text().catch(() => '');
        throw new DraftError(
          'gateway',
          `AI Gateway: HTTP ${response.status}${body ? ` — ${body.slice(0, 250)}` : ''}`,
        );
      }

      const json = (await response.json()) as ChatResponse;
      if (json.error?.message) throw new DraftError('gateway', `AI Gateway: ${json.error.message}`);

      const raw = json.choices?.[0]?.message?.content ?? '';
      const { text, wellFormed } = parseBeurteilung(raw);

      return {
        text,
        wellFormed,
        fehlt: extractFehltMarkers(text),
        model: json.model ?? model,
        promptVersion: BEURTEILUNG_PROMPT_VERSION,
        latencyMs: Date.now() - started,
        usage: {
          ...(json.usage?.prompt_tokens !== undefined
            ? { inputTokens: json.usage.prompt_tokens }
            : {}),
          ...(json.usage?.completion_tokens !== undefined
            ? { outputTokens: json.usage.completion_tokens }
            : {}),
        },
      };
    },
  };
}
