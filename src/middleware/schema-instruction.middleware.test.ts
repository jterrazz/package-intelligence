import type { LanguageModelV4CallOptions } from '@ai-sdk/provider';
import { describe, expect, it } from 'vitest';

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
    const middleware = createSchemaInstructionMiddleware();
    return middleware.transformParams!({
        model: {} as never,
        params,
        type: 'generate',
    });
}

describe('createSchemaInstructionMiddleware', () => {
    it('leaves params untouched when there is no responseFormat', async () => {
        const result = await transform(baseParams);

        expect(result).toEqual(baseParams);
    });

    it('leaves params untouched for text responseFormat', async () => {
        const params = { ...baseParams, responseFormat: { type: 'text' as const } };

        const result = await transform(params);

        expect(result).toEqual(params);
    });

    it('appends the schema instruction to the last user message', async () => {
        const params = {
            ...baseParams,
            responseFormat: { schema: jsonSchema, type: 'json' as const },
        };

        const result = await transform(params);

        expect(result.prompt).toHaveLength(2);
        const user = result.prompt[1];
        expect(user.role).toBe('user');
        const parts = user.content as { text: string; type: string }[];
        expect(parts).toHaveLength(1);
        expect(parts[0].text).toContain('Hello');
        expect(parts[0].text).toContain('valid JSON only');
        expect(parts[0].text).toContain(JSON.stringify(jsonSchema));
        expect(result.prompt[0]).toEqual(baseParams.prompt[0]);
    });

    it('targets the LAST user message in multi-turn prompts', async () => {
        const params: LanguageModelV4CallOptions = {
            prompt: [
                { content: [{ text: 'First', type: 'text' }], role: 'user' },
                { content: [{ text: 'Answer', type: 'text' }], role: 'assistant' },
                { content: [{ text: 'Second', type: 'text' }], role: 'user' },
            ],
            responseFormat: { schema: jsonSchema, type: 'json' },
        };

        const result = await transform(params);

        const [first, , last] = result.prompt;
        expect((first.content as { text: string }[])[0].text).toBe('First');
        expect((last.content as { text: string }[])[0].text).toContain('Second');
        expect((last.content as { text: string }[])[0].text).toContain('valid JSON only');
    });

    it('appends a user message when the prompt has none', async () => {
        const params: LanguageModelV4CallOptions = {
            prompt: [{ content: 'Be terse.', role: 'system' }],
            responseFormat: { schema: jsonSchema, type: 'json' },
        };

        const result = await transform(params);

        expect(result.prompt).toHaveLength(2);
        expect(result.prompt[1].role).toBe('user');
    });

    it('keeps the original responseFormat in the params', async () => {
        const params = {
            ...baseParams,
            responseFormat: { schema: jsonSchema, type: 'json' as const },
        };

        const result = await transform(params);

        expect(result.responseFormat).toEqual(params.responseFormat);
    });

    it('still instructs JSON-only output when no schema is provided', async () => {
        const params = { ...baseParams, responseFormat: { type: 'json' as const } };

        const result = await transform(params);

        const parts = result.prompt[1].content as { text: string }[];
        expect(parts[0].text).toContain('valid JSON only');
        expect(parts[0].text).not.toContain('JSON schema');
    });
});
