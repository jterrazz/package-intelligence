import { APICallError } from '@ai-sdk/provider';
import { trace } from '@opentelemetry/api';
import { generateText, wrapLanguageModel } from 'ai';
import { MockLanguageModelV4 } from 'ai/test';
import { afterEach, describe, expect, test, vi } from 'vitest';

import { cleanAiText } from '../../src/formatting.js';
import {
    createCostMiddleware,
    createFallbackModel,
    createLoggingMiddleware,
} from '../../src/index.js';

function createMockLogger() {
    const logger = {
        child: vi.fn(() => logger),
        debug: vi.fn(),
        error: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
    };
    return logger;
}

function generateResult(text: string, providerMetadata?: Record<string, unknown>) {
    return {
        content: [{ type: 'text' as const, text }],
        finishReason: 'stop' as const,
        providerMetadata,
        usage: {
            inputTokens: { total: 100 },
            outputTokens: { total: 50 },
        },
        warnings: [],
    };
}

describe('composition: cost + logging + fallback wrapped around a real LanguageModelV4', () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    test('cost and logging middleware both run on a successful generation', async () => {
        // Given -- a mock model wrapped with cost + logging middleware, and an active span
        const span = { setAttribute: vi.fn() };
        vi.spyOn(trace, 'getActiveSpan').mockReturnValue(span as never);

        const logger = createMockLogger();
        const baseModel = new MockLanguageModelV4({
            doGenerate: generateResult('Hello, world!', {
                openrouter: { usage: { cost: 0.0013 } },
            }),
        });

        const model = wrapLanguageModel({
            middleware: [
                createCostMiddleware({ modelRef: 'openrouter/mock-model' }),
                createLoggingMiddleware({ logger }),
            ],
            model: baseModel,
        });

        // When
        const { text } = await generateText({ model, prompt: 'Say hello' });

        // Then -- both middlewares observed the call
        expect(text).toBe('Hello, world!');
        expect(span.setAttribute).toHaveBeenCalledWith('gen_ai.usage.cost', 0.0013);
        expect(logger.debug).toHaveBeenCalledWith('ai.generate.start', expect.any(Object));
        expect(logger.debug).toHaveBeenCalledWith(
            'ai.generate.complete',
            expect.objectContaining({ finishReason: 'stop' }),
        );
    });

    test('fallback model switches to the secondary model on a retryable failure, and the composed model still carries cost middleware', async () => {
        // Given -- a primary model that always fails with a 503, and a healthy fallback
        const primary = new MockLanguageModelV4({
            doGenerate: () => {
                throw new APICallError({
                    message: 'Service unavailable',
                    requestBodyValues: {},
                    statusCode: 503,
                    url: 'https://openrouter.ai',
                });
            },
            modelId: 'primary-model',
        });
        const fallback = new MockLanguageModelV4({
            doGenerate: generateResult('Response from fallback'),
            modelId: 'fallback-model',
        });

        const logger = createMockLogger();
        const composed = createFallbackModel({ fallback, logger, primary });

        const model = wrapLanguageModel({
            middleware: [createCostMiddleware({ modelRef: 'openrouter/primary-model' })],
            model: composed,
        });

        // When
        const { text } = await generateText({ model, prompt: 'Say hello' });

        // Then -- the fallback response is returned and the switch was logged
        expect(text).toBe('Response from fallback');
        expect(logger.warn).toHaveBeenCalledWith(
            'ai.fallback.triggered',
            expect.objectContaining({ modelIds: ['primary-model', 'fallback-model'] }),
        );
    });
});

describe('cleanAiText (dependency-free entry point)', () => {
    test('sanitizes AI-generated text', () => {
        // Given -- AI output with smart quotes, ellipsis, and a BOM
        const dirty = `﻿“Hello” …`;

        // Then -- cleanAiText normalizes it
        expect(cleanAiText(dirty)).toBe('"Hello" ...');
    });
});
