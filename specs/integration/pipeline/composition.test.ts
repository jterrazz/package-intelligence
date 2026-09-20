import { APICallError } from '@ai-sdk/provider';
import type { SharedV4ProviderMetadata } from '@ai-sdk/provider';
import type { LoggerPort } from '@jterrazz/telemetry';
import { trace } from '@opentelemetry/api';
import { generateText, wrapLanguageModel } from 'ai';
import { MockLanguageModelV4 } from 'ai/test';
import { afterEach, expect, test, vi } from 'vitest';

import {
    createCostMiddleware,
    createFallbackModel,
    createLoggingMiddleware,
} from '../../../src/index.js';
import { integration } from '../integration.specification.js';

type LogRecord = { event: string; level: string; meta: Record<string, unknown> | undefined };

function createRecordingLogger(): { logger: LoggerPort; records: LogRecord[] } {
    const records: LogRecord[] = [];
    const at =
        (level: string) =>
        (event: string, meta?: Record<string, unknown>): void => {
            records.push({ event, level, meta });
        };
    const logger: LoggerPort = {
        child: () => logger,
        debug: at('debug'),
        error: at('error'),
        info: at('info'),
        warn: at('warn'),
    };
    return { logger, records };
}

function recordSpanAttributes(): Record<string, unknown> {
    const attributes: Record<string, unknown> = {};
    const span = {
        setAttribute: (key: string, value: unknown) => {
            attributes[key] = value;
        },
    };
    vi.spyOn(trace, 'getActiveSpan').mockReturnValue(span as never);
    return attributes;
}

function generateResult(text: string, providerMetadata?: SharedV4ProviderMetadata) {
    return {
        content: [{ type: 'text' as const, text }],
        finishReason: { raw: 'stop', unified: 'stop' as const },
        usage: {
            inputTokens: { cacheRead: undefined, cacheWrite: undefined, noCache: 100, total: 100 },
            outputTokens: { reasoning: undefined, text: 50, total: 50 },
        },
        warnings: [],
        ...(providerMetadata === undefined ? {} : { providerMetadata }),
    };
}

afterEach(() => {
    vi.restoreAllMocks();
});

test('cost and logging both observe a generation the model answered', async () => {
    // Given - a real LanguageModelV4 wrapped in cost and logging middleware, under an active span
    const attributes = recordSpanAttributes();
    const { logger, records } = createRecordingLogger();

    const result = await integration.call(async () => {
        const model = wrapLanguageModel({
            middleware: [createCostMiddleware(), createLoggingMiddleware({ logger })],
            model: new MockLanguageModelV4({
                doGenerate: generateResult('Hello, world!', {
                    openrouter: { usage: { cost: 0.0013 } },
                }),
            }),
        });

        const { text } = await generateText({ model, prompt: 'Say hello' });
        return { attributes, logs: records, text };
    });

    // Then - the answer, the cost the provider reported, and both log events, whole
    expect(result.value).toMatch('answered-generation.json');
    await expect(result.error).toBeEmpty();
});

test('a retryable failure on the primary trips the fallback, and cost still lands', async () => {
    // Given - a primary that always answers 503, a healthy fallback, and cost middleware over both
    const attributes = recordSpanAttributes();
    const { logger, records } = createRecordingLogger();

    const result = await integration.call(async () => {
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
            doGenerate: generateResult('Response from fallback', {
                openrouter: { usage: { cost: 0.0007 } },
            }),
            modelId: 'fallback-model',
        });

        const model = wrapLanguageModel({
            middleware: [createCostMiddleware()],
            model: createFallbackModel({ fallback, logger, primary }),
        });

        const { text } = await generateText({ model, prompt: 'Say hello' });
        return { attributes, logs: records, text };
    });

    // Then - the fallback's answer, the switch it logged, and the cost of the call that worked
    expect(result.value).toMatch('fallback-generation.json');
    await expect(result.error).toBeEmpty();
});
