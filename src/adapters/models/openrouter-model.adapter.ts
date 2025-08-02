import type { BaseLanguageModel } from '@langchain/core/language_models/base';
import { ChatOpenAI } from '@langchain/openai';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import type { LanguageModelV1 } from 'ai';

import type { ModelConfig, ModelPort } from '../../ports/model.port.js';

import type { OpenRouterConfig } from '../providers/openrouter-provider.adapter.js';

/**
 * OpenRouter model wrapper supporting both LangChain and Vercel AI SDK
 */
export class OpenRouterModel implements ModelPort {
    private readonly langchainModel: BaseLanguageModel;
    private readonly modelConfig: ModelConfig;
    private readonly vercelModel: LanguageModelV1;

    constructor(
        private readonly providerConfig: OpenRouterConfig,
        private readonly modelName: string,
        modelConfig: ModelConfig = {},
    ) {
        this.modelConfig = {
            maxTokens: 256_000,
            reasoning: {
                effort: 'high',
                exclude: true,
            },
            ...modelConfig,
        };

        // LangChain model setup
        this.langchainModel = new ChatOpenAI({
            configuration: {
                baseURL: 'https://openrouter.ai/api/v1',
                defaultHeaders: {
                    ...(this.providerConfig.metadata?.website && {
                        'HTTP-Referer': this.providerConfig.metadata.website,
                    }),
                    ...(this.providerConfig.metadata?.application && {
                        'X-Title': this.providerConfig.metadata.application,
                    }),
                },
            },
            maxTokens: this.modelConfig.maxTokens,
            ...(this.modelConfig.reasoning && {
                modelKwargs: {
                    reasoning: this.modelConfig.reasoning,
                },
            }),
            modelName: this.modelName,
            openAIApiKey: this.providerConfig.apiKey,
        });

        // Vercel AI SDK model setup
        const openrouter = createOpenRouter({
            apiKey: this.providerConfig.apiKey,
        });

        this.vercelModel = openrouter(this.modelName, {
            ...(this.modelConfig.maxTokens && { maxTokens: this.modelConfig.maxTokens }),
            ...(this.modelConfig.reasoning && {
                extraBody: {
                    reasoning: this.modelConfig.reasoning,
                },
            }),
        });
    }

    /**
     * Get the configured LangChain language model instance
     */
    getLangchainModel(): BaseLanguageModel {
        return this.langchainModel;
    }

    /**
     * Get the configured Vercel AI SDK language model instance
     */
    getVercelModel(): LanguageModelV1 {
        return this.vercelModel;
    }
}
