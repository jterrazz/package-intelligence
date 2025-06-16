import type { BaseLanguageModel } from '@langchain/core/language_models/base';
import { ChatOpenAI } from '@langchain/openai';

import type { Model } from '../../ports/model.port.js';

export interface OpenRouterConfig {
    /**
     * OpenRouter API key
     */
    apiKey: string;
    /**
     * The model to use (e.g., 'google/gemini-2.5-flash-preview-05-20:thinking')
     */
    modelName: string;
    /**
     * Application title for X-Title header (optional)
     */
    title?: string;
    /**
     * Website URL for HTTP-Referer header (optional)
     */
    websiteUrl?: string;
}

/**
 * OpenRouter adapter that provides access to various models through OpenRouter's API
 */
export class OpenRouterAdapter implements Model {
    private readonly model: BaseLanguageModel;

    constructor(config: OpenRouterConfig) {
        this.model = new ChatOpenAI({
            configuration: {
                baseURL: 'https://openrouter.ai/api/v1',
                defaultHeaders: {
                    ...(config.websiteUrl && { 'HTTP-Referer': config.websiteUrl }),
                    ...(config.title && { 'X-Title': config.title }),
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
