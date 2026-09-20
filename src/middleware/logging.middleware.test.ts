import { describe, expect, test, vi } from 'vitest';

import { createLoggingMiddleware } from './logging.middleware.js';

// `expect.any(Number)` is typed `any`, so the widening is named once here and
// the payload literals below stay exactly typed.
const ANY_DURATION_MS: number = expect.any(Number);

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
        test('logs start and completion on success', async () => {
            // Given -- a logging middleware with a mock logger and successful generation
            const logger = createMockLogger();
            const middleware = createLoggingMiddleware({ logger });
            const mockResult = createMockGenerateResult();
            const doGenerate = vi.fn().mockResolvedValue(mockResult);
            const model = createMockModel();

            const result = await middleware.wrapGenerate?.({
                doGenerate,
                doStream: vi.fn(),
                params: { prompt: [] },
                model: model as never,
            });

            // Then -- two debug events, each carrying exactly the payload the middleware promises
            expect(logger.debug).toHaveBeenCalledTimes(2);
            expect(logger.debug).toHaveBeenNthCalledWith(1, 'ai.generate.start', {
                model: 'test-model',
            });
            expect(logger.debug).toHaveBeenNthCalledWith(2, 'ai.generate.complete', {
                model: 'test-model',
                durationMs: ANY_DURATION_MS,
                finishReason: 'stop',
                usage: mockResult.usage,
            });
            expect(result).toBe(mockResult);
        });

        test('logs error on failure', async () => {
            // Given -- a logging middleware with a mock logger and a failing generation
            const logger = createMockLogger();
            const middleware = createLoggingMiddleware({ logger });
            const error = new Error('API error');
            const doGenerate = vi.fn().mockRejectedValue(error);
            const model = createMockModel();

            // Then -- the error is re-thrown and logged
            await expect(
                middleware.wrapGenerate?.({
                    doGenerate,
                    doStream: vi.fn(),
                    params: { prompt: [] },
                    model: model as never,
                }),
            ).rejects.toThrow('API error');

            expect(logger.debug).toHaveBeenCalledWith('ai.generate.start', { model: 'test-model' });
            expect(logger.error).toHaveBeenCalledWith('ai.generate.error', {
                model: 'test-model',
                durationMs: ANY_DURATION_MS,
                error: 'API error',
            });
        });

        test('includes params when include.params is true', async () => {
            // Given -- a logging middleware configured to include params
            const logger = createMockLogger();
            const middleware = createLoggingMiddleware({ logger, include: { params: true } });
            const mockResult = createMockGenerateResult();
            const mockParams = { prompt: [] };
            const doGenerate = vi.fn().mockResolvedValue(mockResult);
            const model = createMockModel();

            await middleware.wrapGenerate?.({
                doGenerate,
                doStream: vi.fn(),
                params: mockParams,
                model: model as never,
            });

            // Then -- the start log carries the params beside the model, and nothing else
            expect(logger.debug).toHaveBeenNthCalledWith(1, 'ai.generate.start', {
                model: 'test-model',
                params: mockParams,
            });
        });

        test('includes content when include.content is true', async () => {
            // Given -- a logging middleware configured to include content
            const logger = createMockLogger();
            const middleware = createLoggingMiddleware({ logger, include: { content: true } });
            const mockResult = createMockGenerateResult();
            const doGenerate = vi.fn().mockResolvedValue(mockResult);
            const model = createMockModel();

            await middleware.wrapGenerate?.({
                doGenerate,
                doStream: vi.fn(),
                params: { prompt: [] },
                model: model as never,
            });

            // Then -- the completion log carries the generated text beside the usual fields
            expect(logger.debug).toHaveBeenNthCalledWith(2, 'ai.generate.complete', {
                model: 'test-model',
                durationMs: ANY_DURATION_MS,
                finishReason: 'stop',
                usage: mockResult.usage,
                content: 'Hello world',
            });
        });

        test('excludes usage when include.usage is false', async () => {
            // Given -- a logging middleware configured to exclude usage
            const logger = createMockLogger();
            const middleware = createLoggingMiddleware({ logger, include: { usage: false } });
            const mockResult = createMockGenerateResult();
            const doGenerate = vi.fn().mockResolvedValue(mockResult);
            const model = createMockModel();

            await middleware.wrapGenerate?.({
                doGenerate,
                doStream: vi.fn(),
                params: { prompt: [] },
                model: model as never,
            });

            // Then -- the completion log is the usual payload minus usage
            expect(logger.debug).toHaveBeenNthCalledWith(2, 'ai.generate.complete', {
                model: 'test-model',
                durationMs: ANY_DURATION_MS,
                finishReason: 'stop',
            });
        });
    });
});
