// Ports
import type {
    ExtractedProviderMetadata,
    ProviderMetadataPort,
} from '../ports/provider-metadata.port.js';

interface OpenRouterUsage {
    promptTokens?: number;
    promptTokensDetails?: { cachedTokens?: number };
    completionTokens?: number;
    completionTokensDetails?: { reasoningTokens?: number };
    totalTokens?: number;
    cost?: number;
}

interface OpenRouterProviderMetadata {
    provider?: string;
    usage?: OpenRouterUsage;
}

/**
 * OpenRouter adapter for extracting usage and cost from provider metadata
 */
export class OpenRouterMetadataAdapter implements ProviderMetadataPort {
    extract(providerMetadata: Record<string, unknown> | undefined): ExtractedProviderMetadata {
        const meta = providerMetadata?.openrouter as OpenRouterProviderMetadata | undefined;

        if (!meta?.usage) {
            return {};
        }

        const usage = meta.usage;

        return {
            usage: {
                input: usage.promptTokens ?? 0,
                output: usage.completionTokens ?? 0,
                total: usage.totalTokens,
                reasoning: usage.completionTokensDetails?.reasoningTokens,
                cacheRead: usage.promptTokensDetails?.cachedTokens,
            },
            cost: usage.cost !== undefined ? { total: usage.cost } : undefined,
        };
    }
}
