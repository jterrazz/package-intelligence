import type {
  ExtractedProviderMetadata,
  ProviderMetadataPort,
} from "../ports/provider-metadata.port.js";

interface OpenAIUsage {
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
}

interface OpenAIProviderMetadata {
  responseId?: string;
  usage?: OpenAIUsage;
}

/**
 * Metadata adapter for OpenAI-compatible APIs (including gateway-intelligence).
 * Extracts usage data from the standardized OpenAI response format.
 */
export class OpenAICompatibleMetadataAdapter implements ProviderMetadataPort {
  extract(providerMetadata: Record<string, unknown> | undefined): ExtractedProviderMetadata {
    const meta = providerMetadata?.openai as OpenAIProviderMetadata | undefined;

    if (!meta?.usage) {
      return {};
    }

    const usage = meta.usage;

    return {
      usage: {
        input: usage.promptTokens ?? 0,
        output: usage.completionTokens ?? 0,
        total: usage.totalTokens,
      },
    };
  }
}
