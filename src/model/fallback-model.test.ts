import { APICallError } from '@ai-sdk/provider';
import { describe, expect, test, vi } from 'vitest';

import { createFallbackModel } from './fallback-model.js';

function createMockLogger() {
    return {
        child: vi.fn(() => createMockLogger()),
        debug: vi.fn(),
        error: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
    };
}

function createMockModel(modelId: string, overrides: Record<string, unknown> = {}) {
    return {
        modelId,
        provider: 'test',
        specificationVersion: 'v4' as const,
        supportedUrls: {},
        doGenerate: vi.fn(),
        doStream: vi.fn(),
        ...overrides,
    };
}

function apiCallError(statusCode: number) {
    return new APICallError({
        message: `HTTP ${statusCode}`,
        url: 'https://example.com',
        requestBodyValues: {},
        statusCode,
    });
}

const successResult = {
    content: [{ type: 'text' as const, text: 'ok' }],
    finishReason: 'stop' as const,
    usage: { inputTokens: { total: 1 }, outputTokens: { total: 1 } },
    warnings: [],
};

describe('createFallbackModel', () => {
    test('returns the primary result when primary succeeds', async () => {
        // Given -- a primary model that succeeds
        const primary = createMockModel('primary', {
            doGenerate: vi.fn().mockResolvedValue(successResult),
        });
        const fallback = createMockModel('fallback', { doGenerate: vi.fn() });
        const logger = createMockLogger();

        const model = createFallbackModel({
            primary: primary as never,
            fallback: fallback as never,
            logger,
        });

        // When
        const result = await (
            model as never as { doGenerate: (o: unknown) => Promise<unknown> }
        ).doGenerate({});

        // Then -- fallback is never invoked and no warning is logged
        expect(result).toBe(successResult);
        expect(fallback.doGenerate).not.toHaveBeenCalled();
        expect(logger.warn).not.toHaveBeenCalled();
    });

    test('falls back on a 429 error', async () => {
        // Given -- a primary model rejecting with a 429 APICallError
        const primary = createMockModel('primary', {
            doGenerate: vi.fn().mockRejectedValue(apiCallError(429)),
        });
        const fallback = createMockModel('fallback', {
            doGenerate: vi.fn().mockResolvedValue(successResult),
        });
        const logger = createMockLogger();

        const model = createFallbackModel({
            primary: primary as never,
            fallback: fallback as never,
            logger,
        });

        // When
        const result = await (
            model as never as { doGenerate: (o: unknown) => Promise<unknown> }
        ).doGenerate({});

        // Then -- the fallback model is used and a warning is logged
        expect(result).toBe(successResult);
        expect(fallback.doGenerate).toHaveBeenCalledTimes(1);
        expect(logger.warn).toHaveBeenCalledWith(
            'ai.fallback.triggered',
            expect.objectContaining({ modelIds: ['primary', 'fallback'] }),
        );
    });

    test('falls back on a 500 error', async () => {
        // Given -- a primary model rejecting with a 500 APICallError
        const primary = createMockModel('primary', {
            doGenerate: vi.fn().mockRejectedValue(apiCallError(500)),
        });
        const fallback = createMockModel('fallback', {
            doGenerate: vi.fn().mockResolvedValue(successResult),
        });

        const model = createFallbackModel({
            primary: primary as never,
            fallback: fallback as never,
        });

        // When
        const result = await (
            model as never as { doGenerate: (o: unknown) => Promise<unknown> }
        ).doGenerate({});

        // Then
        expect(result).toBe(successResult);
        expect(fallback.doGenerate).toHaveBeenCalledTimes(1);
    });

    test('falls back on a network error', async () => {
        // Given -- a primary model rejecting with a raw network error
        const networkError = new Error('connect ECONNREFUSED 127.0.0.1:443');
        const primary = createMockModel('primary', {
            doGenerate: vi.fn().mockRejectedValue(networkError),
        });
        const fallback = createMockModel('fallback', {
            doGenerate: vi.fn().mockResolvedValue(successResult),
        });

        const model = createFallbackModel({
            primary: primary as never,
            fallback: fallback as never,
        });

        // When
        const result = await (
            model as never as { doGenerate: (o: unknown) => Promise<unknown> }
        ).doGenerate({});

        // Then
        expect(result).toBe(successResult);
        expect(fallback.doGenerate).toHaveBeenCalledTimes(1);
    });

    test('does not fall back on a 400 error', async () => {
        // Given -- a primary model rejecting with a non-retryable 400 APICallError
        const error = apiCallError(400);
        const primary = createMockModel('primary', {
            doGenerate: vi.fn().mockRejectedValue(error),
        });
        const fallback = createMockModel('fallback', { doGenerate: vi.fn() });
        const logger = createMockLogger();

        const model = createFallbackModel({
            primary: primary as never,
            fallback: fallback as never,
            logger,
        });

        // Then -- the original error propagates and fallback is never invoked
        await expect(
            (model as never as { doGenerate: (o: unknown) => Promise<unknown> }).doGenerate({}),
        ).rejects.toBe(error);
        expect(fallback.doGenerate).not.toHaveBeenCalled();
        expect(logger.warn).not.toHaveBeenCalled();
    });

    test('does not fall back on a validation/abort error', async () => {
        // Given -- a primary model rejecting with a generic (non-retryable) error
        const error = new Error('Invalid request: missing required field');
        const primary = createMockModel('primary', {
            doGenerate: vi.fn().mockRejectedValue(error),
        });
        const fallback = createMockModel('fallback', { doGenerate: vi.fn() });

        const model = createFallbackModel({
            primary: primary as never,
            fallback: fallback as never,
        });

        // Then
        await expect(
            (model as never as { doGenerate: (o: unknown) => Promise<unknown> }).doGenerate({}),
        ).rejects.toBe(error);
        expect(fallback.doGenerate).not.toHaveBeenCalled();
    });

    test('falls back for doStream on a retryable error', async () => {
        // Given -- a primary model whose doStream rejects with a 503
        const streamResult = { stream: new ReadableStream() };
        const primary = createMockModel('primary', {
            doStream: vi.fn().mockRejectedValue(apiCallError(503)),
        });
        const fallback = createMockModel('fallback', {
            doStream: vi.fn().mockResolvedValue(streamResult),
        });

        const model = createFallbackModel({
            primary: primary as never,
            fallback: fallback as never,
        });

        // When
        const result = await (
            model as never as { doStream: (o: unknown) => Promise<unknown> }
        ).doStream({});

        // Then
        expect(result).toBe(streamResult);
        expect(fallback.doStream).toHaveBeenCalledTimes(1);
    });

    test('delegates static properties to the primary model', () => {
        // Given -- primary and fallback models with distinct identities
        const primary = createMockModel('primary-model', { provider: 'primary-provider' });
        const fallback = createMockModel('fallback-model', { provider: 'fallback-provider' });

        // When
        const model = createFallbackModel({
            primary: primary as never,
            fallback: fallback as never,
        });

        // Then -- static properties mirror the primary model
        expect((model as never as { modelId: string }).modelId).toBe('primary-model');
        expect((model as never as { provider: string }).provider).toBe('primary-provider');
    });
});
