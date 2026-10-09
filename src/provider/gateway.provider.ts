import { createOpenAI } from '@ai-sdk/openai';
import type { LanguageModelV4 } from '@ai-sdk/provider';
import { extractJsonMiddleware, wrapLanguageModel } from 'ai';

import { createSchemaInstructionMiddleware } from '../middleware/schema-instruction.middleware.js';

export type GatewayConfig = {
    /** Base URL of the gateway's chat-completions endpoint */
    baseURL: string;
    apiKey?: string;
};

export type GatewayProvider = {
    model: (id: string) => LanguageModelV4;
};

/** A provider for any OpenAI-compatible chat-completions gateway, its models wrapped for structured output. */
export function createGatewayProvider(config: GatewayConfig): GatewayProvider {
    // hazard: with no key, @ai-sdk/openai falls back to OPENAI_API_KEY, which would hand the process's OpenAI key to the gateway.
    const openai = createOpenAI({ apiKey: config.apiKey ?? '', baseURL: config.baseURL });

    return {
        model(id: string): LanguageModelV4 {
            return wrapLanguageModel({
                // outside: the base callable targets the Responses API, which most gateways do not implement.
                model: openai.chat(id),
                middleware: [createSchemaInstructionMiddleware(), extractJsonMiddleware()],
            });
        },
    };
}
