import type { LanguageModelV4 } from '@ai-sdk/provider';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import type { LanguageModel } from 'ai';

export type OpenRouterMetadata = {
    /** Application name, sent as the `X-OpenRouter-Title` header for dashboard attribution */
    application?: string;
    /** Application URL, sent as the `HTTP-Referer` header for dashboard attribution */
    website?: string;
};

export type OpenRouterConfig = {
    apiKey: string;
    metadata?: OpenRouterMetadata;
};

export type OpenRouterProvider = {
    model: (id: string) => LanguageModel;
};

/** An OpenRouter provider; per-call options go in `providerOptions.openrouter`. */
export function createOpenRouterProvider(config: OpenRouterConfig): OpenRouterProvider {
    const openrouter = createOpenRouter({
        apiKey: config.apiKey,
        ...(config.metadata?.application === undefined
            ? {}
            : { appName: config.metadata.application }),
        ...(config.metadata?.website === undefined ? {} : { appUrl: config.metadata.website }),
    });

    return {
        model(id: string): LanguageModelV4 {
            return openrouter(id);
        },
    };
}
