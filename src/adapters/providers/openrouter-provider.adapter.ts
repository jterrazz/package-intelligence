import type { ModelConfig } from '../../ports/model.port.js';
import type { ProviderPort } from '../../ports/provider.port.js';

import { OpenRouterModel } from '../models/openrouter-model.adapter.js';

export interface OpenRouterConfig {
    /**
     * OpenRouter API key
     */
    apiKey: string;
    /**
     * Optional metadata for request headers
     */
    metadata?: OpenRouterMetadata;
}

export interface OpenRouterMetadata {
    /**
     * Application title for X-Title header
     */
    application?: string;
    /**
     * Website URL for HTTP-Referer header
     */
    website?: string;
}

/**
 * OpenRouter provider that manages connection configuration
 */
export class OpenRouterProvider implements ProviderPort {
    constructor(private readonly config: OpenRouterConfig) {}

    /**
     * Get a model instance for the specified model name
     */
    getModel(modelName: string, modelConfig: ModelConfig = {}) {
        return new OpenRouterModel(this.config, modelName, modelConfig);
    }
}
