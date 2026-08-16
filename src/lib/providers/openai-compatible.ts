import { DraftError, type DraftProviderId } from './draft-types.ts';

/**
 * Shared chat-completions call for the OpenAI-shaped providers (Mistral and the
 * AI Gateway). Anthropic has its own SDK and its own adapter.
 */

export interface ChatOptions {
  endpoint: string;
  apiKey: string;
  model: string;
  system: string;
  user: string;
  maxTokens?: number;
  providerId: DraftProviderId;
  signal?: AbortSignal;
}

export interface ChatResult {
  raw: string;
  model: string;
  usage?: { inputTokens?: number; outputTokens?: number };
}

interface ApiShape {
  model?: string;
  choices?: Array<{ message?: { content?: string } }>;
  usage?: { prompt_tokens?: number; completion_tokens?: number };
  error?: { message?: string };
}

export async function chatCompletion(opts: ChatOptions): Promise<ChatResult> {
  let response: Response;
  try {
    response = await fetch(opts.endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${opts.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: opts.model,
        max_tokens: opts.maxTokens ?? 4_000,
        messages: [
          { role: 'system', content: opts.system },
          { role: 'user', content: opts.user },
        ],
      }),
      ...(opts.signal ? { signal: opts.signal } : {}),
    });
  } catch (error) {
    throw new DraftError(opts.providerId, 'Der Dienst ist nicht erreichbar.', error);
  }

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new DraftError(
      opts.providerId,
      `HTTP ${response.status}${body ? ` — ${body.slice(0, 250)}` : ''}`,
    );
  }

  const json = (await response.json()) as ApiShape;
  if (json.error?.message) throw new DraftError(opts.providerId, json.error.message);

  return {
    raw: json.choices?.[0]?.message?.content ?? '',
    model: json.model ?? opts.model,
    usage: {
      ...(json.usage?.prompt_tokens !== undefined ? { inputTokens: json.usage.prompt_tokens } : {}),
      ...(json.usage?.completion_tokens !== undefined
        ? { outputTokens: json.usage.completion_tokens }
        : {}),
    },
  };
}
