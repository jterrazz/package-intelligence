import type { BaseLanguageModel } from '@langchain/core/language_models/base';
import { ChatOpenAI } from '@langchain/openai';

import type { ModelPort } from '../../ports/model.port.js';

export interface OpenRouterConfig {
    /**
     * OpenRouter API key
     */
    apiKey: string;
    /**
     * The maximum number of tokens to generate
     */
    maxTokens?: number;
    /**
     * Optional metadata for request headers
     */
    metadata?: OpenRouterMetadata;
    /**
     * The model to use (e.g., 'google/gemini-2.5-flash-preview-05-20:thinking')
     */
    modelName: string;
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
 * OpenRouter adapter that provides access to various models through OpenRouter's API
 */
export class OpenRouterModelAdapter implements ModelPort {
    private readonly model: BaseLanguageModel;

    constructor(config: OpenRouterConfig) {
        this.model = new ChatOpenAI({
            configuration: {
                baseURL: 'https://openrouter.ai/api/v1',
                defaultHeaders: {
                    ...(config.metadata?.website && {
                        'HTTP-Referer': config.metadata.website,
                    }),
                    ...(config.metadata?.application && { 'X-Title': config.metadata.application }),
                },
            },
            maxTokens: config.maxTokens ?? 64_000,
            modelKwargs: {
                reasoning: {
                    effort: 'high',
                    exclude: true,
                },
            },
            modelName: config.modelName,
            openAIApiKey: config.apiKey,
        });
    }

    getModel(): BaseLanguageModel {
        return this.model;
    }
}
