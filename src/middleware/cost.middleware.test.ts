import { trace } from '@opentelemetry/api';
import { afterEach, describe, expect, test, vi } from 'vitest';

import { createCostMiddleware } from './cost.middleware.js';

function createMockSpan() {
    return { setAttribute: vi.fn() };
}

function throwTelemetryError(): never {
    throw new Error('telemetry backend exploded');
}

function createMockModel() {
    return {
        modelId: 'test-model',
        provider: 'test',
        specificationVersion: 'v2' as const,
        supportsImageUrls: false,
        supportsStructuredOutputs: false,
        doGenerate: vi.fn(),
        doStream: vi.fn(),
    };
}

function createMockGenerateResult(overrides: Record<string, unknown> = {}) {
    return {
        content: [{ type: 'text' as const, text: 'Hello world' }],
        finishReason: 'stop' as const,
        usage: {
            inputTokens: { total: 1_000_000 },
            outputTokens: { total: 500_000 },
        },
        warnings: [],
        ...overrides,
    };
}

describe('createCostMiddleware', () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('wrapGenerate', () => {
        test('prefers the actual OpenRouter cost over pricing estimation', async () => {
            // Given -- an OpenRouter result reporting an actual cost, and pricing configured too
            const span = createMockSpan();
            vi.spyOn(trace, 'getActiveSpan').mockReturnValue(span as never);

            const middleware = createCostMiddleware({
                modelRef: 'openrouter/test-model',
                pricing: { input: 100, output: 100 },
            });
            const result = createMockGenerateResult({
                providerMetadata: { openrouter: { usage: { cost: 0.0042 } } },
            });
            const doGenerate = vi.fn().mockResolvedValue(result);

            // When
            await middleware.wrapGenerate?.({
                doGenerate,
                doStream: vi.fn(),
                params: {} as never,
                model: createMockModel() as never,
            });

            // Then -- the actual reported cost is used, not the pricing estimate
            expect(span.setAttribute).toHaveBeenCalledWith('gen_ai.usage.cost', 0.0042);
        });

        test('falls back to pricing estimation when actual cost is absent', async () => {
            // Given -- a result with no provider cost, but pricing configured
            const span = createMockSpan();
            vi.spyOn(trace, 'getActiveSpan').mockReturnValue(span as never);

            const middleware = createCostMiddleware({
                modelRef: 'openrouter/test-model',
                pricing: { input: 1, output: 2 },
            });
            const doGenerate = vi.fn().mockResolvedValue(createMockGenerateResult());

            // When -- 1M input tokens @ $1/M + 0.5M output tokens @ $2/M
            await middleware.wrapGenerate?.({
                doGenerate,
                doStream: vi.fn(),
                params: {} as never,
                model: createMockModel() as never,
            });

            // Then
            expect(span.setAttribute).toHaveBeenCalledWith('gen_ai.usage.cost', 2);
        });

        test('falls back to pricing estimation when actual cost is zero', async () => {
            // Given -- a zero-cost OpenRouter response (e.g. free model) with pricing configured
            const span = createMockSpan();
            vi.spyOn(trace, 'getActiveSpan').mockReturnValue(span as never);

            const middleware = createCostMiddleware({
                modelRef: 'openrouter/test-model',
                pricing: { input: 1, output: 2 },
            });
            const result = createMockGenerateResult({
                providerMetadata: { openrouter: { usage: { cost: 0 } } },
            });
            const doGenerate = vi.fn().mockResolvedValue(result);

            // When
            await middleware.wrapGenerate?.({
                doGenerate,
                doStream: vi.fn(),
                params: {} as never,
                model: createMockModel() as never,
            });

            // Then
            expect(span.setAttribute).toHaveBeenCalledWith('gen_ai.usage.cost', 2);
        });

        test('sets only the model attribute when no cost can be determined', async () => {
            // Given -- no actual cost and no pricing configured
            const span = createMockSpan();
            vi.spyOn(trace, 'getActiveSpan').mockReturnValue(span as never);

            const middleware = createCostMiddleware({ modelRef: 'openrouter/test-model' });
            const doGenerate = vi.fn().mockResolvedValue(createMockGenerateResult());

            // When
            await middleware.wrapGenerate?.({
                doGenerate,
                doStream: vi.fn(),
                params: {} as never,
                model: createMockModel() as never,
            });

            // Then
            expect(span.setAttribute).toHaveBeenCalledExactlyOnceWith(
                'gen_ai.request.model',
                'openrouter/test-model',
            );
        });

        test('never throws when there is no active span', async () => {
            // Given -- no active span (getActiveSpan returns undefined, the real default)
            vi.spyOn(trace, 'getActiveSpan').mockReturnValue(undefined);

            const middleware = createCostMiddleware({
                modelRef: 'openrouter/test-model',
                pricing: { input: 1, output: 2 },
            });
            const doGenerate = vi.fn().mockResolvedValue(createMockGenerateResult());

            // Then -- the call resolves without throwing
            await expect(
                middleware.wrapGenerate?.({
                    doGenerate,
                    doStream: vi.fn(),
                    params: {} as never,
                    model: createMockModel() as never,
                }),
            ).resolves.toBeDefined();
        });

        test('never throws when enrichment itself fails', async () => {
            // Given -- setAttribute throws (simulating a broken telemetry backend)
            const span = { setAttribute: vi.fn(() => throwTelemetryError()) };
            vi.spyOn(trace, 'getActiveSpan').mockReturnValue(span as never);

            const middleware = createCostMiddleware({
                modelRef: 'openrouter/test-model',
                pricing: { input: 1, output: 2 },
            });
            const doGenerate = vi.fn().mockResolvedValue(createMockGenerateResult());

            // Then -- generation still resolves successfully
            await expect(
                middleware.wrapGenerate?.({
                    doGenerate,
                    doStream: vi.fn(),
                    params: {} as never,
                    model: createMockModel() as never,
                }),
            ).resolves.toBeDefined();
        });
    });

    describe('wrapStream', () => {
        test('records cost from the finish stream part on flush', async () => {
            // Given -- a stream ending in a finish part carrying usage and provider metadata
            const span = createMockSpan();
            vi.spyOn(trace, 'getActiveSpan').mockReturnValue(span as never);

            const middleware = createCostMiddleware({
                modelRef: 'openrouter/test-model',
                pricing: { input: 1, output: 2 },
            });

            const doStream = vi.fn().mockResolvedValue({
                stream: new ReadableStream({
                    start(controller) {
                        controller.enqueue({ type: 'text-delta', id: '1', delta: 'Hi' });
                        controller.enqueue({
                            type: 'finish',
                            finishReason: 'stop',
                            usage: {
                                inputTokens: { total: 1_000_000 },
                                outputTokens: { total: 0 },
                            },
                            providerMetadata: { openrouter: { usage: { cost: 0.01 } } },
                        });
                        controller.close();
                    },
                }),
            });

            // When -- the stream is fully drained
            const result = await middleware.wrapStream?.({
                doStream,
                doGenerate: vi.fn(),
                params: {} as never,
                model: createMockModel() as never,
            });

            const reader = result?.stream.getReader();
            for (;;) {
                const chunk = await reader?.read();
                if (!chunk || chunk.done) {
                    break;
                }
            }

            // Then -- the actual OpenRouter cost from the finish part is recorded
            expect(span.setAttribute).toHaveBeenCalledWith('gen_ai.usage.cost', 0.01);
        });
    });
});
