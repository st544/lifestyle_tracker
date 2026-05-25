/**
 * Minimal Anthropic Messages API client built on `fetch`.
 *
 * Why fetch instead of @anthropic-ai/sdk?
 *   The official SDK is built for Node and browser environments. Imported into
 *   React Native it pulls Node built-ins (stream, crypto, fs, …) through Metro's
 *   polyfill chain, which on SDK 54 + the new architecture causes
 *   "installTurboModule called with N arguments" runtime crashes. Since we make
 *   one short request per day with no streaming, tool use, or caching, raw
 *   fetch is leaner and avoids the polyfill mess entirely.
 */

const API_URL = 'https://api.anthropic.com/v1/messages';
const API_VERSION = '2023-06-01';

/**
 * Default Claude model for the daily insight. Opus 4.7 produces excellent
 * analysis; cost is ~$0.005/call (~$2/year @ once/day). If you'd like to
 * cut cost further, swap to `claude-haiku-4-5` — for this single-shot
 * summarization task, quality is generally still strong.
 */
export const INSIGHT_MODEL = 'claude-sonnet-4-6';

// --- Errors -----------------------------------------------------------------

export class MissingApiKeyError extends Error {
  constructor() {
    super('No Anthropic API key set. Add one in Goals & Settings.');
    this.name = 'MissingApiKeyError';
  }
}

export class AnthropicApiError extends Error {
  status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.name = 'AnthropicApiError';
    this.status = status;
  }
}

// --- Types ------------------------------------------------------------------

export type MessageRole = 'user' | 'assistant';

export interface MessageParam {
  role: MessageRole;
  content: string;
}

export interface JsonSchema {
  type: 'object';
  properties: Record<string, unknown>;
  required?: string[];
  additionalProperties?: boolean;
}

export interface MessagesCreateParams {
  model: string;
  max_tokens: number;
  system?: string;
  messages: MessageParam[];
  output_config?: {
    format: {
      type: 'json_schema';
      schema: JsonSchema;
    };
  };
}

export interface ContentBlock {
  type: string;       // 'text' for normal output
  text?: string;
}

export interface MessagesResponse {
  id: string;
  type: 'message';
  role: 'assistant';
  model: string;
  content: ContentBlock[];
  stop_reason: string;
  usage: {
    input_tokens: number;
    output_tokens: number;
  };
}

// --- Call -------------------------------------------------------------------

export async function callAnthropic(
  apiKey: string,
  params: MessagesCreateParams,
): Promise<MessagesResponse> {
  if (!apiKey || !apiKey.trim()) throw new MissingApiKeyError();

  let response: Response;
  try {
    response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'x-api-key': apiKey.trim(),
        'anthropic-version': API_VERSION,
        'content-type': 'application/json',
      },
      body: JSON.stringify(params),
    });
  } catch (err: any) {
    throw new AnthropicApiError(
      `Network error reaching api.anthropic.com: ${err?.message ?? 'unknown'}`,
    );
  }

  if (!response.ok) {
    const status = response.status;
    let detail = '';
    try {
      const body = await response.json();
      detail = body?.error?.message ?? JSON.stringify(body);
    } catch {
      try { detail = await response.text(); } catch { /* ignore */ }
    }
    if (status === 401) throw new AnthropicApiError('Invalid API key.', status);
    if (status === 429) throw new AnthropicApiError('Rate limited — try again in a minute.', status);
    throw new AnthropicApiError(`Anthropic API error (${status}): ${detail || 'request failed'}`, status);
  }

  return response.json() as Promise<MessagesResponse>;
}
