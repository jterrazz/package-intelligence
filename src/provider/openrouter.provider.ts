import type { LanguageModelV4 } from '@ai-sdk/provider';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import type { LanguageModel } from 'ai';

export interface OpenRouterMetadata {
    /** Application name, sent as the `X-OpenRouter-Title` header for dashboard attribution */
    application?: string;
    /** Application URL, sent as the `HTTP-Referer` header for dashboard attribution */
    website?: string;
}

export interface OpenRouterConfig {
    apiKey: string;
    metadata?: OpenRouterMetadata;
}

export interface OpenRouterProvider {
    /** Get a language model instance for the given OpenRouter model id */
    model: (id: string) => LanguageModel;
}

/**
 * Creates an OpenRouter provider for AI SDK models.
 *
 * Per-call options (reasoning effort, max tokens, etc.) are no longer
 * configured here — pass them at the call site via `providerOptions.openrouter`
 * on `generateText`/`streamText`.
 *
 * @example
 * ```ts
 * const provider = createOpenRouterProvider({ apiKey: process.env.OPENROUTER_API_KEY });
 * const model = provider.model('anthropic/claude-sonnet-4-20250514');
 *
 * const { text } = await generateText({
 *   model,
 *   prompt: 'Hello!',
 *   providerOptions: { openrouter: { reasoning: { effort: 'high' } } },
 * });
 * ```
 */
export function createOpenRouterProvider(config: OpenRouterConfig): OpenRouterProvider {
    const openrouter = createOpenRouter({
        apiKey: config.apiKey,
        appName: config.metadata?.application,
        appUrl: config.metadata?.website,
    });

    return {
        model(id: string): LanguageModelV4 {
            return openrouter(id);
        },
    };
}
