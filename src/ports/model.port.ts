import type { BaseLanguageModel } from '@langchain/core/language_models/base';

/**
 * Port for models
 */
export interface ModelPort {
    /**
     * Get the configured language model instance
     */
    getModel(): BaseLanguageModel;
}
