import type { LanguageModelV2 } from '@ai-sdk/provider';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { generateStructured } from '../generate-structured.js';

function createMockModel(options: { text?: string; shouldThrow?: Error } = {}): LanguageModelV2 {
    const { text = '{}', shouldThrow } = options;

    return {
        specificationVersion: 'v2',
        provider: 'mock',
        modelId: 'mock-model',
        doGenerate: shouldThrow
            ? vi.fn().mockRejectedValue(shouldThrow)
            : vi.fn().mockResolvedValue({
                  text,
                  finishReason: 'stop',
                  usage: { promptTokens: 10, completionTokens: 20 },
                  rawCall: { rawPrompt: null, rawSettings: {} },
                  content: [{ type: 'text', text }],
              }),
        supportedUrls: undefined as never,
        doStream: vi.fn(),
    };
}

describe('generateStructured', () => {
    const schema = z.object({
        name: z.string(),
        score: z.number(),
    });

    it('returns success with parsed data on valid response', async () => {
        const model = createMockModel({
            text: JSON.stringify({ name: 'test', score: 42 }),
        });

        const result = await generateStructured({
            model,
            prompt: 'Generate data',
            schema,
        });

        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data).toEqual({ name: 'test', score: 42 });
        }
    });

    it('parses JSON from markdown code blocks', async () => {
        const jsonBlock = '```json\n' + '{"name": "test", "score": 100}' + '\n```';
        const model = createMockModel({ text: jsonBlock });

        const result = await generateStructured({
            model,
            prompt: 'Generate data',
            schema,
        });

        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data).toEqual({ name: 'test', score: 100 });
        }
    });

    it('returns EMPTY_RESULT for empty response', async () => {
        const model = createMockModel({ text: '' });

        const result = await generateStructured({
            model,
            prompt: 'Generate data',
            schema,
        });

        expect(result.success).toBe(false);
        if (!result.success) {
            expect(result.error.code).toBe('EMPTY_RESULT');
        }
    });

    it('returns PARSING_FAILED for invalid JSON', async () => {
        const model = createMockModel({ text: 'not valid json' });

        const result = await generateStructured({
            model,
            prompt: 'Generate data',
            schema,
        });

        expect(result.success).toBe(false);
        if (!result.success) {
            expect(result.error.code).toBe('PARSING_FAILED');
        }
    });

    it('returns TIMEOUT for timeout errors', async () => {
        const model = createMockModel({
            shouldThrow: new Error('Request timed out'),
        });

        const result = await generateStructured({
            model,
            prompt: 'Generate data',
            schema,
        });

        expect(result.success).toBe(false);
        if (!result.success) {
            expect(result.error.code).toBe('TIMEOUT');
        }
    });

    it('returns RATE_LIMITED for rate limit errors', async () => {
        const model = createMockModel({
            shouldThrow: new Error('Rate limit exceeded'),
        });

        const result = await generateStructured({
            model,
            prompt: 'Generate data',
            schema,
        });

        expect(result.success).toBe(false);
        if (!result.success) {
            expect(result.error.code).toBe('RATE_LIMITED');
        }
    });

    it('passes provider options to generateText', async () => {
        const model = createMockModel({
            text: JSON.stringify({ name: 'test', score: 1 }),
        });

        await generateStructured({
            model,
            prompt: 'Generate data',
            schema,
            providerOptions: { observability: { traceId: 'trace-123' } },
        });

        expect(model.doGenerate).toHaveBeenCalledWith(
            expect.objectContaining({
                providerOptions: { observability: { traceId: 'trace-123' } },
            }),
        );
    });
});
