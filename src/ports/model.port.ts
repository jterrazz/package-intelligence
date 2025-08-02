import type { BaseLanguageModel } from '@langchain/core/language_models/base';
import type { LanguageModelV1 } from 'ai';

/**
 * General model configuration for reasoning and token limits
 */
export interface ModelConfig {
    /**
     * The maximum number of tokens to generate
     */
    maxTokens?: number;
    /**
     * Reasoning configuration for models that support it
     */
    reasoning?: {
        /**
         * Reasoning effort level (e.g., 'low', 'medium', 'high')
         */
        effort?: string;
        /**
         * Whether to exclude reasoning from the response
         */
        exclude?: boolean;
    };
}

/**
 * Port for models supporting both LangChain and Vercel AI SDK
 */
export interface ModelPort {
    /**
     * Get the configured LangChain language model instance
     */
    getLangchainModel(): BaseLanguageModel;

    /**
     * Get the configured Vercel AI SDK language model instance
     */
    getVercelModel(): LanguageModelV1;
}
