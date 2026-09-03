import Anthropic from '@anthropic-ai/sdk';

import {
  BEURTEILUNG_PROMPT_VERSION,
  buildStableSystemPrompt,
  buildUserPrompt,
  parseBeurteilung,
} from '../../../prompts/beurteilung.ts';
import {
  ABSCHNITT_PROMPT_VERSION,
  buildAbschnittSystemPrompt,
  buildAbschnittUserPrompt,
  parseAbschnitt,
} from '../../../prompts/abschnitt.ts';
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
import {
  DraftError,
  type AbschnittRequest,
  type AbschnittResponse,
  type BeurteilungRequest,
  type BeurteilungResponse,
  type DraftProvider,
  type GespraechRequest,
  type GespraechResponse,
  type UebersetzungRequest,
  type UebersetzungResponse,
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

/**
 * A translation returns the entire letter, plus one wrapper per segment. Two
 * A4 pages of German cardiology run well past the drafting budget once the
 * blocks are counted, and a truncated letter is worse than none.
 */
const TRANSLATION_MAX_TOKENS = 32_000;

export function createAnthropicDraft(apiKey: string): DraftProvider {
  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });

  /** Every feature shares the call shape; only the prompts differ. */
  async function call(system: string, user: string, signal?: AbortSignal, maxTokens = MAX_TOKENS) {
    const message = await client.messages.create(
      {
        model: MODEL,
        max_tokens: maxTokens,
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
        const { heading, text, wellFormed } = parseBeurteilung(result.raw);
        return {
          heading,
          text,
          wellFormed,
          model: result.model,
          promptVersion: BEURTEILUNG_PROMPT_VERSION,
          latencyMs: Date.now() - started,
          usage: result.usage,
        };
      } catch (error) {
        fail(error);
      }
    },

    async draftAbschnitt(request: AbschnittRequest): Promise<AbschnittResponse> {
      const started = Date.now();
      try {
        const result = await call(
          buildAbschnittSystemPrompt(request.glossary),
          buildAbschnittUserPrompt(request),
          request.signal,
        );
        const { heading, text, wellFormed } = parseAbschnitt(result.raw);
        return {
          heading,
          text,
          wellFormed,
          model: result.model,
          promptVersion: ABSCHNITT_PROMPT_VERSION,
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
        const { sections, order, labels, wellFormed } = parseGespraech(result.raw);
        return {
          sections,
          order,
          labels,
          wellFormed,
          model: result.model,
          promptVersion: GESPRAECH_PROMPT_VERSION,
          latencyMs: Date.now() - started,
          usage: result.usage,
        };
      } catch (error) {
        fail(error);
      }
    },

    async translateBericht(request: UebersetzungRequest): Promise<UebersetzungResponse> {
      const started = Date.now();
      try {
        const result = await call(
          buildUebersetzungSystemPrompt(request.language),
          buildUebersetzungUserPrompt(request.segments),
          request.signal,
          // A whole letter comes back, wrapped one block per segment. The
          // drafting budget is sized for one section and would truncate a
          // long Bericht mid-sentence.
          TRANSLATION_MAX_TOKENS,
        );
        const { segments, wellFormed } = parseUebersetzung(result.raw, request.segments.length);
        return {
          segments,
          wellFormed,
          model: result.model,
          promptVersion: UEBERSETZUNG_PROMPT_VERSION,
          latencyMs: Date.now() - started,
          usage: result.usage,
        };
      } catch (error) {
        fail(error);
      }
    },
  };
}
