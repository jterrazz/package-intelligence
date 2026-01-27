import { createOpenAI } from "@ai-sdk/openai";
import type { LanguageModel } from "ai";

export interface OpenAICompatibleModelOptions {
  /** Maximum tokens to generate */
  maxTokens?: number;
}

export interface OpenAICompatibleConfig {
  /** API key for authentication */
  apiKey: string;
  /** Base URL of the OpenAI-compatible API */
  baseURL: string;
  /** Optional model name mapping */
  modelMapping?: Record<string, string>;
}

export interface OpenAICompatibleProvider {
  /** Get a language model instance */
  model: (name: string, options?: OpenAICompatibleModelOptions) => LanguageModel;
}

/**
 * Creates a provider for OpenAI-compatible APIs.
 * Works with any API implementing the OpenAI chat completions spec.
 *
 * @example
 * ```ts
 * // Use with gateway-intelligence (Claude proxy)
 * const provider = createOpenAICompatibleProvider({
 *   apiKey: process.env.GATEWAY_API_KEY,
 *   baseURL: 'https://gateway.jterrazz.com/intelligence/v1',
 * });
 * const model = provider.model('claude-opus-4-5-20250514');
 * ```
 */
export function createOpenAICompatibleProvider(config: OpenAICompatibleConfig): OpenAICompatibleProvider {
  const openai = createOpenAI({
    apiKey: config.apiKey,
    baseURL: config.baseURL,
  });

  return {
    model(name: string, options: OpenAICompatibleModelOptions = {}): LanguageModel {
      // Apply model name mapping if configured
      const modelName = config.modelMapping?.[name] ?? name;

      return openai(modelName, {
        ...(options.maxTokens !== undefined && {
          maxTokens: options.maxTokens,
        }),
      });
    },
  };
}
