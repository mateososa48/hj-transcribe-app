import {
  BEURTEILUNG_PROMPT_VERSION,
  buildStableSystemPrompt,
  buildUserPrompt,
  extractFehltMarkers,
  parseBeurteilung,
} from '../../../prompts/beurteilung.ts';
import { DraftError, type DraftProvider, type DraftRequest, type DraftResponse } from './draft-types.ts';

/**
 * Mistral drafting adapter — the EU-resident option.
 *
 * This exists so SPEC constraint 2 ("EU AI endpoints") is actually satisfiable.
 * If the EU-only rule is upheld, this is the shipping default and Anthropic is
 * disabled; if the rule is relaxed under a DPA, this stays selectable. Which
 * one produces better German cardiology prose is an eval question, not an
 * assumption — see docs/providers.md.
 *
 * CORS verified browser-direct 2026-08-15 (`access-control-allow-origin: *`).
 */

const ENDPOINT = 'https://api.mistral.ai/v1/chat/completions';
const MODEL = 'mistral-large-latest';

interface ChatResponse {
  model?: string;
  choices?: Array<{ message?: { content?: string } }>;
  usage?: { prompt_tokens?: number; completion_tokens?: number };
}

export function createMistralDraft(apiKey: string): DraftProvider {
  return {
    id: 'mistral',
    label: 'Mistral (EU)',
    euHosted: true,

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
            model: MODEL,
            max_tokens: 4_000,
            messages: [
              { role: 'system', content: system },
              { role: 'user', content: buildUserPrompt(request) },
            ],
          }),
          ...(request.signal ? { signal: request.signal } : {}),
        });
      } catch (error) {
        throw new DraftError('mistral', 'Mistral ist nicht erreichbar.', error);
      }

      if (!response.ok) {
        const body = await response.text().catch(() => '');
        throw new DraftError(
          'mistral',
          `Mistral: HTTP ${response.status}${body ? ` — ${body.slice(0, 200)}` : ''}`,
        );
      }

      const json = (await response.json()) as ChatResponse;
      const raw = json.choices?.[0]?.message?.content ?? '';
      const { text, wellFormed } = parseBeurteilung(raw);

      return {
        text,
        wellFormed,
        fehlt: extractFehltMarkers(text),
        model: json.model ?? MODEL,
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
