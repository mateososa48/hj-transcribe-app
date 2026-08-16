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
 * Mistral — the EU-resident drafting option.
 *
 * This exists so SPEC constraint 2 ("EU AI endpoints") is actually satisfiable.
 * If the EU-only rule is upheld, this is the shipping default and Anthropic is
 * disabled; if the rule is relaxed under a DPA, this stays selectable. Which
 * produces better German cardiology prose is an eval question, not an
 * assumption — see docs/providers.md.
 *
 * CORS verified browser-direct 2026-08-15 (`access-control-allow-origin: *`).
 */

const ENDPOINT = 'https://api.mistral.ai/v1/chat/completions';
const MODEL = 'mistral-large-latest';

export function createMistralDraft(apiKey: string): DraftProvider {
  return {
    id: 'mistral',
    label: 'Mistral (EU)',
    euHosted: true,

    async draftBeurteilung(request: DraftRequest): Promise<DraftResponse> {
      const started = Date.now();
      const result = await chatCompletion({
        endpoint: ENDPOINT,
        apiKey,
        model: MODEL,
        providerId: 'mistral',
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
        model: MODEL,
        providerId: 'mistral',
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
