import Anthropic from '@anthropic-ai/sdk';

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
import {
  DraftError,
  type BeurteilungRequest,
  type BeurteilungResponse,
  type DraftProvider,
  type GespraechRequest,
  type GespraechResponse,
} from './draft-types.ts';

/**
 * Anthropic drafting adapter — the intended production path.
 *
 * Browser-direct via the official SDK's `dangerouslyAllowBrowser` mode. The key
 * belongs to HJ and lives on his machine; the usual reason that flag is
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

const MODEL = 'claude-opus-5';

/**
 * Generous because thinking counts against it. Opus 5 runs adaptive thinking by
 * DEFAULT — a tight budget here truncates the answer mid-sentence rather than
 * producing a shorter one.
 */
const MAX_TOKENS = 8_000;

export function createAnthropicDraft(apiKey: string): DraftProvider {
  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });

  /** Both features share the call shape; only the prompts differ. */
  async function call(system: string, user: string, signal?: AbortSignal) {
    const message = await client.messages.create(
      {
        model: MODEL,
        max_tokens: MAX_TOKENS,
        // Cache the rules block: byte-identical on every request, and the large
        // half of the prompt. The patient's transcript goes in `messages`,
        // after the breakpoint, so it never invalidates the cache.
        system: [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }],
        messages: [{ role: 'user', content: user }],
      },
      signal ? { signal } : {},
    );

    if (message.stop_reason === 'refusal') {
      throw new DraftError(
        'anthropic',
        'Die Anfrage wurde vom Modell abgelehnt. Bitte prüfen Sie die Aufnahme.',
      );
    }

    return {
      raw: message.content
        .filter((block): block is Anthropic.TextBlock => block.type === 'text')
        .map((block) => block.text)
        .join('\n'),
      model: message.model,
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
  }

  function fail(error: unknown): never {
    if (error instanceof DraftError) throw error;
    throw new DraftError(
      'anthropic',
      error instanceof Anthropic.APIError
        ? `Anthropic: ${error.status ?? ''} ${error.message}`.trim()
        : 'Der Entwurf konnte nicht erstellt werden.',
      error,
    );
  }

  return {
    id: 'anthropic',
    label: 'Anthropic Claude',
    euHosted: false,

    async draftBeurteilung(request: BeurteilungRequest): Promise<BeurteilungResponse> {
      const started = Date.now();
      try {
        const result = await call(
          buildStableSystemPrompt(request.examples, request.glossary),
          buildUserPrompt(request),
          request.signal,
        );
        const { text, wellFormed } = parseBeurteilung(result.raw);
        return {
          text,
          wellFormed,
          fehlt: extractFehltMarkers(text),
          model: result.model,
          promptVersion: BEURTEILUNG_PROMPT_VERSION,
          latencyMs: Date.now() - started,
          usage: result.usage,
        };
      } catch (error) {
        fail(error);
      }
    },

    async draftGespraech(request: GespraechRequest): Promise<GespraechResponse> {
      const started = Date.now();
      try {
        const result = await call(
          buildGespraechSystemPrompt(request.glossary),
          buildGespraechUserPrompt(request),
          request.signal,
        );
        const { sections, wellFormed } = parseGespraech(result.raw);
        return {
          sections,
          wellFormed,
          fehlt: extractFehltMarkers(Object.values(sections).join('\n')),
          model: result.model,
          promptVersion: GESPRAECH_PROMPT_VERSION,
          latencyMs: Date.now() - started,
          usage: result.usage,
        };
      } catch (error) {
        fail(error);
      }
    },
  };
}
