import { createOpenAI } from '@ai-sdk/openai';
import type { LanguageModelV4 } from '@ai-sdk/provider';
import { extractJsonMiddleware, type LanguageModel, wrapLanguageModel } from 'ai';

import { createSchemaInstructionMiddleware } from '../middleware/schema-instruction.middleware.js';

export interface GatewayConfig {
    /** Base URL of the gateway's chat-completions endpoint */
    baseURL: string;
    /** API key for authentication, if required by the endpoint */
    apiKey?: string;
}

export interface GatewayProvider {
    /** Get a language model instance for the given model id */
    model: (id: string) => LanguageModel;
}

/**
 * Creates a provider for gateways exposing a chat-completions API — any API
 * implementing the OpenAI chat completions spec.
 *
 * Every model returned is automatically wrapped with two safety nets for
 * gateways that don't support native structured output:
 * - `createSchemaInstructionMiddleware` injects the JSON schema into the
 *   system prompt (some gateways silently drop `response_format`);
 * - `extractJsonMiddleware` strips markdown code fences from JSON responses.
 *
 * @example
 * ```ts
 * const provider = createGatewayProvider({ baseURL: 'https://gateway.example.com/v1' });
 * const model = provider.model('gpt-4o-mini');
 *
 * const { text } = await generateText({ model, prompt: 'Hello!' });
 * ```
 */
export function createGatewayProvider(config: GatewayConfig): GatewayProvider {
    const openai = createOpenAI({
        apiKey: config.apiKey,
        baseURL: config.baseURL,
    });

    return {
        model(id: string): LanguageModelV4 {
            // Use `.chat()` explicitly rather than the base callable, which
            // Targets the Responses API — most gateways only implement chat
            // Completions.
            return wrapLanguageModel({
                model: openai.chat(id),
                middleware: [createSchemaInstructionMiddleware(), extractJsonMiddleware()],
            });
        },
    };
}
