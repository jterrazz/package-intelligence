import { describe, expect, it, vi } from 'vitest';

import { createLoggingMiddleware } from '../logging.middleware.js';

function createMockLogger() {
    return {
        child: vi.fn(() => createMockLogger()),
        debug: vi.fn(),
        error: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
    };
}

function createMockModel(modelId = 'test-model') {
    return {
        modelId,
        provider: 'test',
        specificationVersion: 'v2' as const,
        supportsImageUrls: false,
        supportsStructuredOutputs: false,
        doGenerate: vi.fn(),
        doStream: vi.fn(),
    };
}

function createMockGenerateResult() {
    return {
        content: [{ type: 'text' as const, text: 'Hello world' }],
        finishReason: 'stop' as const,
        usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
        warnings: [],
    };
}

describe('createLoggingMiddleware', () => {
    describe('wrapGenerate', () => {
        it('logs start and completion on success', async () => {
            const logger = createMockLogger();
            const middleware = createLoggingMiddleware({ logger });
            const mockResult = createMockGenerateResult();
            const doGenerate = vi.fn().mockResolvedValue(mockResult);
            const model = createMockModel();

            const result = await middleware.wrapGenerate?.({
                doGenerate,
                doStream: vi.fn(),
                params: { prompt: [] } as never,
                model: model as never,
            });

            expect(logger.debug).toHaveBeenCalledTimes(2);
            expect(logger.debug).toHaveBeenNthCalledWith(1, 'ai.generate.start', {
                model: 'test-model',
            });
            expect(logger.debug).toHaveBeenNthCalledWith(
                2,
                'ai.generate.complete',
                expect.objectContaining({
                    model: 'test-model',
                    durationMs: expect.any(Number),
                    finishReason: 'stop',
                    usage: mockResult.usage,
                }),
            );
            expect(result).toBe(mockResult);
        });

        it('logs error on failure', async () => {
            const logger = createMockLogger();
            const middleware = createLoggingMiddleware({ logger });
            const error = new Error('API error');
            const doGenerate = vi.fn().mockRejectedValue(error);
            const model = createMockModel();

            await expect(
                middleware.wrapGenerate?.({
                    doGenerate,
                    doStream: vi.fn(),
                    params: { prompt: [] } as never,
                    model: model as never,
                }),
            ).rejects.toThrow('API error');

            expect(logger.debug).toHaveBeenCalledWith('ai.generate.start', { model: 'test-model' });
            expect(logger.error).toHaveBeenCalledWith(
                'ai.generate.error',
                expect.objectContaining({
                    model: 'test-model',
                    durationMs: expect.any(Number),
                    error: 'API error',
                }),
            );
        });

        it('includes params when include.params is true', async () => {
            const logger = createMockLogger();
            const middleware = createLoggingMiddleware({ logger, include: { params: true } });
            const mockResult = createMockGenerateResult();
            const mockParams = { prompt: [] };
            const doGenerate = vi.fn().mockResolvedValue(mockResult);
            const model = createMockModel();

            await middleware.wrapGenerate?.({
                doGenerate,
                doStream: vi.fn(),
                params: mockParams as never,
                model: model as never,
            });

            expect(logger.debug).toHaveBeenNthCalledWith(
                1,
                'ai.generate.start',
                expect.objectContaining({ params: mockParams }),
            );
        });

        it('includes content when include.content is true', async () => {
            const logger = createMockLogger();
            const middleware = createLoggingMiddleware({ logger, include: { content: true } });
            const mockResult = createMockGenerateResult();
            const doGenerate = vi.fn().mockResolvedValue(mockResult);
            const model = createMockModel();

            await middleware.wrapGenerate?.({
                doGenerate,
                doStream: vi.fn(),
                params: { prompt: [] } as never,
                model: model as never,
            });

            expect(logger.debug).toHaveBeenNthCalledWith(
                2,
                'ai.generate.complete',
                expect.objectContaining({ content: 'Hello world' }),
            );
        });

        it('excludes usage when include.usage is false', async () => {
            const logger = createMockLogger();
            const middleware = createLoggingMiddleware({ logger, include: { usage: false } });
            const mockResult = createMockGenerateResult();
            const doGenerate = vi.fn().mockResolvedValue(mockResult);
            const model = createMockModel();

            await middleware.wrapGenerate?.({
                doGenerate,
                doStream: vi.fn(),
                params: { prompt: [] } as never,
                model: model as never,
            });

            const completedCall = logger.debug.mock.calls[1];
            expect(completedCall[1]).not.toHaveProperty('usage');
        });
    });

    describe('middleware structure', () => {
        it('returns middleware with v2 version', () => {
            const logger = createMockLogger();
            const middleware = createLoggingMiddleware({ logger });

            expect(middleware.middlewareVersion).toBe('v2');
        });
    });
});
