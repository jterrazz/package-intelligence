import type { CostDetails, UsageDetails } from './observability.port.js';

/**
 * Extracted metadata from a provider response
 */
export interface ExtractedProviderMetadata {
    usage?: UsageDetails;
    cost?: CostDetails;
}

/**
 * Port for extracting usage and cost data from provider-specific metadata.
 * Implement this interface for each AI provider (OpenRouter, Anthropic, etc.)
 */
export interface ProviderMetadataPort {
    /**
     * Extract usage and cost data from provider metadata
     * @param metadata - The raw provider metadata from AI SDK response
     * @returns Extracted usage and cost details, or undefined values if not available
     */
    extract(metadata: Record<string, unknown> | undefined): ExtractedProviderMetadata;
}
