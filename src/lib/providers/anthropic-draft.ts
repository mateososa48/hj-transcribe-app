import Anthropic from '@anthropic-ai/sdk';

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
import {
  DraftError,
  type DraftProvider,
  type DraftRequest,
  type DraftResponse,
  type TranslateRequest,
  type TranslateResponse,
} from './draft-types.ts';

/**
 * Anthropic drafting adapter.
 *
 * Browser-direct via the official SDK's `dangerouslyAllowBrowser` mode. The key
 * belongs to HJ and lives on his machine — the usual reason that flag is
 * dangerous (shipping YOUR key to every visitor) does not apply to a
 * single-user local-first app. Verified 2026-08-15: the API returns CORS
 * headers only when the preflight requests
 * `anthropic-dangerous-direct-browser-access`, which the SDK sets for us.
 *
 * NOTE ON RESIDENCY: api.anthropic.com is US-served. Under SPEC constraint 2
 * ("EU AI endpoints") this provider is only permissible if that constraint is
 * relaxed to allow US processing under a DPA. The UI badges it accordingly;
 * see docs/providers.md for the open decision.
 */

const MODEL = 'claude-sonnet-5';

/**
 * Generous because thinking counts against it. Sonnet 5 runs adaptive thinking
 * by DEFAULT — a tight budget here truncates the answer mid-sentence rather
 * than producing a shorter one.
 */
const MAX_TOKENS = 8_000;

export function createAnthropicDraft(apiKey: string): DraftProvider {
  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });

  return {
    id: 'anthropic',
    label: 'Anthropic Claude',
    euHosted: false,

    async draftBeurteilung(request: DraftRequest): Promise<DraftResponse> {
      const started = Date.now();
      const system = buildStableSystemPrompt(request.examples, request.glossary);

      try {
        const message = await client.messages.create(
          {
            model: MODEL,
            max_tokens: MAX_TOKENS,
            // Cache the rules + few-shot block: it is byte-identical on every
            // letter, and it is the large half of the prompt. The patient's
            // transcript goes in `messages`, after the breakpoint, so it never
            // invalidates the cache.
            system: [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }],
            messages: [{ role: 'user', content: buildUserPrompt(request) }],
          },
          request.signal ? { signal: request.signal } : {},
        );

        const raw = message.content
          .filter((block): block is Anthropic.TextBlock => block.type === 'text')
          .map((block) => block.text)
          .join('\n');

        if (message.stop_reason === 'refusal') {
          throw new DraftError(
            'anthropic',
            'Die Anfrage wurde vom Modell abgelehnt. Bitte prüfen Sie das Diktat.',
          );
        }

        const { text, wellFormed } = parseBeurteilung(raw);

        return {
          text,
          wellFormed,
          fehlt: extractFehltMarkers(text),
          model: message.model,
          promptVersion: BEURTEILUNG_PROMPT_VERSION,
          latencyMs: Date.now() - started,
          usage: {
            inputTokens: message.usage.input_tokens,
            outputTokens: message.usage.output_tokens,
            ...(message.usage.cache_read_input_tokens !== null
              ? { cacheReadTokens: message.usage.cache_read_input_tokens }
              : {}),
            ...(message.usage.cache_creation_input_tokens !== null
              ? { cacheWriteTokens: message.usage.cache_creation_input_tokens }
              : {}),
          },
        };
      } catch (error) {
        if (error instanceof DraftError) throw error;
        throw new DraftError(
          'anthropic',
          error instanceof Anthropic.APIError
            ? `Anthropic: ${error.status ?? ''} ${error.message}`.trim()
            : 'Der Entwurf konnte nicht erstellt werden.',
          error,
        );
      }
    },

    async translate(request: TranslateRequest): Promise<TranslateResponse> {
      const started = Date.now();
      try {
        const message = await client.messages.create(
          {
            model: MODEL,
            max_tokens: MAX_TOKENS,
            system: buildTranslationSystemPrompt(request.target),
            messages: [
              { role: 'user', content: buildTranslationUserPrompt(request.text, request.target) },
            ],
          },
          request.signal ? { signal: request.signal } : {},
        );

        const raw = message.content
          .filter((block): block is Anthropic.TextBlock => block.type === 'text')
          .map((block) => block.text)
          .join('\n');

        const { text, wellFormed } = parseTranslation(raw);
        return {
          text,
          wellFormed,
          check: checkTranslation(request.text, text),
          model: message.model,
          latencyMs: Date.now() - started,
        };
      } catch (error) {
        throw new DraftError(
          'anthropic',
          error instanceof Anthropic.APIError
            ? `Anthropic: ${error.status ?? ''} ${error.message}`.trim()
            : 'Die Übersetzung konnte nicht erstellt werden.',
          error,
        );
      }
    },
  };
}
