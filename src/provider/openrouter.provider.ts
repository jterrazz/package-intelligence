import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import type { LanguageModel } from 'ai';

export interface ModelOptions {
    /** Maximum tokens to generate */
    maxTokens?: number;
    /** Reasoning configuration for supported models */
    reasoning?: {
        effort?: 'high' | 'low' | 'medium';
        exclude?: boolean;
    };
}

export interface OpenRouterConfig {
    apiKey: string;
    metadata?: OpenRouterMetadata;
}

export interface OpenRouterMetadata {
    /** Application name for X-Title header */
    application?: string;
    /** Website URL for HTTP-Referer header */
    website?: string;
}

export interface OpenRouterProvider {
    /** Get a language model instance */
    model: (name: string, options?: ModelOptions) => LanguageModel;
}

/**
 * Creates an OpenRouter provider for AI SDK models.
 *
 * @example
 * ```ts
 * const provider = createOpenRouterProvider({ apiKey: process.env.OPENROUTER_API_KEY });
 * const model = provider.model('anthropic/claude-sonnet-4-20250514');
 *
 * const { text } = await generateText({ model, prompt: 'Hello!' });
 * ```
 */
export function createOpenRouterProvider(config: OpenRouterConfig): OpenRouterProvider {
    const openrouter = createOpenRouter({ apiKey: config.apiKey });

    return {
        model(name: string, options: ModelOptions = {}): LanguageModel {
            return openrouter(name, {
                ...(options.maxTokens !== undefined && {
                    maxTokens: options.maxTokens,
                }),
                ...(options.reasoning && {
                    extraBody: { reasoning: options.reasoning },
                }),
            });
        },
    };
}
