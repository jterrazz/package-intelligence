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
 */
export function createOpenAICompatibleProvider(
  config: OpenAICompatibleConfig,
): OpenAICompatibleProvider {
  const openai = createOpenAI({
    apiKey: config.apiKey,
    baseURL: config.baseURL,
  });

  return {
    model(name: string, _options: OpenAICompatibleModelOptions = {}): LanguageModel {
      const modelName = config.modelMapping?.[name] ?? name;
      return openai(modelName);
    },
  };
}
