import { describe, expect, it, vi } from 'vitest';

import { createLoggingMiddleware } from '../logging.middleware.js';

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

function createMockGenerateResult() {
    return {
        content: [{ type: 'text' as const, text: 'Hello world' }],
        finishReason: 'stop' as const,
        usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
        warnings: [],
    };
}

function createMockStreamResult() {
    return {
        stream: new ReadableStream(),
        warnings: [],
    };
}

describe('createLoggingMiddleware', () => {
    describe('wrapGenerate', () => {
        it('logs request start and completion on success', async () => {
            const logger = createMockLogger();
            const middleware = createLoggingMiddleware({ logger });
            const mockResult = createMockGenerateResult();
            const doGenerate = vi.fn().mockResolvedValue(mockResult);

            const result = await middleware.wrapGenerate?.({
                doGenerate,
                doStream: vi.fn(),
                params: {} as never,
                model: {} as never,
            });

            expect(logger.debug).toHaveBeenCalledTimes(2);
            expect(logger.debug).toHaveBeenNthCalledWith(1, 'Model request started', {});
            expect(logger.debug).toHaveBeenNthCalledWith(
                2,
                'Model request completed',
                expect.objectContaining({
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

            await expect(
                middleware.wrapGenerate?.({
                    doGenerate,
                    doStream: vi.fn(),
                    params: {} as never,
                    model: {} as never,
                }),
            ).rejects.toThrow('API error');

            expect(logger.debug).toHaveBeenCalledWith('Model request started', {});
            expect(logger.error).toHaveBeenCalledWith(
                'Model request failed',
                expect.objectContaining({
                    durationMs: expect.any(Number),
                    error: 'API error',
                }),
            );
        });

        it('includes params when include.params is true', async () => {
            const logger = createMockLogger();
            const middleware = createLoggingMiddleware({ logger, include: { params: true } });
            const mockResult = createMockGenerateResult();
            const mockParams = { prompt: 'Hello' };
            const doGenerate = vi.fn().mockResolvedValue(mockResult);

            await middleware.wrapGenerate?.({
                doGenerate,
                doStream: vi.fn(),
                params: mockParams as never,
                model: {} as never,
            });

            expect(logger.debug).toHaveBeenNthCalledWith(
                1,
                'Model request started',
                expect.objectContaining({ params: mockParams }),
            );
        });

        it('includes content when include.content is true', async () => {
            const logger = createMockLogger();
            const middleware = createLoggingMiddleware({ logger, include: { content: true } });
            const mockResult = createMockGenerateResult();
            const doGenerate = vi.fn().mockResolvedValue(mockResult);

            await middleware.wrapGenerate?.({
                doGenerate,
                doStream: vi.fn(),
                params: {} as never,
                model: {} as never,
            });

            expect(logger.debug).toHaveBeenNthCalledWith(
                2,
                'Model request completed',
                expect.objectContaining({ content: mockResult.content }),
            );
        });

        it('excludes usage when include.usage is false', async () => {
            const logger = createMockLogger();
            const middleware = createLoggingMiddleware({ logger, include: { usage: false } });
            const mockResult = createMockGenerateResult();
            const doGenerate = vi.fn().mockResolvedValue(mockResult);

            await middleware.wrapGenerate?.({
                doGenerate,
                doStream: vi.fn(),
                params: {} as never,
                model: {} as never,
            });

            expect(logger.debug).toHaveBeenNthCalledWith(
                2,
                'Model request completed',
                expect.not.objectContaining({ usage: expect.anything() }),
            );
        });
    });

    describe('wrapStream', () => {
        it('logs stream start on success', async () => {
            const logger = createMockLogger();
            const middleware = createLoggingMiddleware({ logger });
            const mockResult = createMockStreamResult();
            const doStream = vi.fn().mockResolvedValue(mockResult);

            const result = await middleware.wrapStream?.({
                doGenerate: vi.fn(),
                doStream,
                params: {} as never,
                model: {} as never,
            });

            expect(logger.debug).toHaveBeenCalledWith('Model stream started', {});
            expect(result?.stream).toBe(mockResult.stream);
        });

        it('logs error on stream failure', async () => {
            const logger = createMockLogger();
            const middleware = createLoggingMiddleware({ logger });
            const error = new Error('Stream error');
            const doStream = vi.fn().mockRejectedValue(error);

            await expect(
                middleware.wrapStream?.({
                    doGenerate: vi.fn(),
                    doStream,
                    params: {} as never,
                    model: {} as never,
                }),
            ).rejects.toThrow('Stream error');

            expect(logger.error).toHaveBeenCalledWith(
                'Model stream failed',
                expect.objectContaining({
                    durationMs: expect.any(Number),
                    error: 'Stream error',
                }),
            );
        });

        it('includes params when include.params is true', async () => {
            const logger = createMockLogger();
            const middleware = createLoggingMiddleware({ logger, include: { params: true } });
            const mockResult = createMockStreamResult();
            const mockParams = { prompt: 'Hello' };
            const doStream = vi.fn().mockResolvedValue(mockResult);

            await middleware.wrapStream?.({
                doGenerate: vi.fn(),
                doStream,
                params: mockParams as never,
                model: {} as never,
            });

            expect(logger.debug).toHaveBeenCalledWith(
                'Model stream started',
                expect.objectContaining({ params: mockParams }),
            );
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
