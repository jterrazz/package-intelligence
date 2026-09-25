import { createOpenAI } from '@ai-sdk/openai';
import type { LanguageModelV4 } from '@ai-sdk/provider';
import { extractJsonMiddleware, wrapLanguageModel } from 'ai';
import type { LanguageModel } from 'ai';

import { createSchemaInstructionMiddleware } from '../middleware/schema-instruction.middleware.js';

export type GatewayConfig = {
    /** Base URL of the gateway's chat-completions endpoint */
    baseURL: string;
    apiKey?: string;
};

export type GatewayProvider = {
    model: (id: string) => LanguageModel;
};

/** A provider for any OpenAI-compatible chat-completions gateway, its models wrapped for structured output. */
export function createGatewayProvider(config: GatewayConfig): GatewayProvider {
    const openai = createOpenAI({
        baseURL: config.baseURL,
        ...(config.apiKey === undefined ? {} : { apiKey: config.apiKey }),
    });

    return {
        model(id: string): LanguageModelV4 {
            // The base callable targets the Responses API, which most gateways do not implement.
            return wrapLanguageModel({
                model: openai.chat(id),
                middleware: [createSchemaInstructionMiddleware(), extractJsonMiddleware()],
            });
        },
    };
}
