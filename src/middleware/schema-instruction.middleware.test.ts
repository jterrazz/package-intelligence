import type { LanguageModelV4CallOptions } from '@ai-sdk/provider';
import { describe, expect, test } from 'vitest';

import { createSchemaInstructionMiddleware } from './schema-instruction.middleware.js';

const baseParams: LanguageModelV4CallOptions = {
    prompt: [
        { content: 'Be terse.', role: 'system' },
        { content: [{ text: 'Hello', type: 'text' }], role: 'user' },
    ],
};

const jsonSchema = {
    properties: { capital: { type: 'string' as const } },
    required: ['capital'],
    type: 'object' as const,
};

async function transform(params: LanguageModelV4CallOptions): Promise<LanguageModelV4CallOptions> {
    const { transformParams } = createSchemaInstructionMiddleware();
    if (transformParams === undefined) {
        throw new Error('the schema-instruction middleware must transform params');
    }
    return await transformParams({
        model: {} as never,
        params,
        type: 'generate',
    });
}

/**
 * The text of the first content part of `prompt[index]` — what every case below
 * asserts on, read through one place that fails loudly on an absent message.
 */
function partText(params: LanguageModelV4CallOptions, index: number): string {
    const parts = params.prompt[index]?.content as undefined | { text: string }[];
    const text = parts?.[0]?.text;
    if (text === undefined) {
        throw new Error(`prompt[${index}] carries no text content part`);
    }
    return text;
}

describe('createSchemaInstructionMiddleware', () => {
    test('leaves params untouched when there is no responseFormat', async () => {
        const result = await transform(baseParams);

        expect(result).toStrictEqual(baseParams);
    });

    test('leaves params untouched for text responseFormat', async () => {
        const params = { ...baseParams, responseFormat: { type: 'text' as const } };

        const result = await transform(params);

        expect(result).toStrictEqual(params);
    });

    test('appends the schema instruction to the last user message', async () => {
        const params = {
            ...baseParams,
            responseFormat: { schema: jsonSchema, type: 'json' as const },
        };

        const result = await transform(params);

        expect(result.prompt).toHaveLength(2);
        expect(result.prompt[1]?.role).toBe('user');
        expect(result.prompt[1]?.content).toHaveLength(1);
        expect(partText(result, 1)).toContain('Hello');
        expect(partText(result, 1)).toContain('valid JSON only');
        expect(partText(result, 1)).toContain(JSON.stringify(jsonSchema));
        expect(result.prompt[0]).toStrictEqual(baseParams.prompt[0]);
    });

    test('targets the LAST user message in multi-turn prompts', async () => {
        const params: LanguageModelV4CallOptions = {
            prompt: [
                { content: [{ text: 'First', type: 'text' }], role: 'user' },
                { content: [{ text: 'Answer', type: 'text' }], role: 'assistant' },
                { content: [{ text: 'Second', type: 'text' }], role: 'user' },
            ],
            responseFormat: { schema: jsonSchema, type: 'json' },
        };

        const result = await transform(params);

        expect(partText(result, 0)).toBe('First');
        expect(partText(result, 2)).toContain('Second');
        expect(partText(result, 2)).toContain('valid JSON only');
    });

    test('appends a user message when the prompt has none', async () => {
        const params: LanguageModelV4CallOptions = {
            prompt: [{ content: 'Be terse.', role: 'system' }],
            responseFormat: { schema: jsonSchema, type: 'json' },
        };

        const result = await transform(params);

        expect(result.prompt).toHaveLength(2);
        expect(result.prompt[1]?.role).toBe('user');
    });

    test('keeps the original responseFormat in the params', async () => {
        const params = {
            ...baseParams,
            responseFormat: { schema: jsonSchema, type: 'json' as const },
        };

        const result = await transform(params);

        expect(result.responseFormat).toStrictEqual(params.responseFormat);
    });

    test('still instructs JSON-only output when no schema is provided', async () => {
        const params = { ...baseParams, responseFormat: { type: 'json' as const } };

        const result = await transform(params);

        expect(partText(result, 1)).toContain('valid JSON only');
        expect(partText(result, 1)).not.toContain('JSON schema');
    });
});
