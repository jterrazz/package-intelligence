import type { ModelConfig } from './model.port.js';
import type { ModelPort } from './model.port.js';

/**
 * Provider port interface for model providers
 */
export interface ProviderPort {
    /**
     * Get a model instance configured with this provider
     * @param modelName - The model to use (e.g., 'openai/gpt-4o')
     * @param modelConfig - Optional model configuration
     */
    getModel(modelName: string, modelConfig?: ModelConfig): ModelPort;
}
