import { APICallError } from '@ai-sdk/provider';
import { generateText } from 'ai';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import { createIntelligence } from './create-intelligence.js';

const { modelOverrides } = vi.hoisted(() => ({
    modelOverrides: new Map<string, () => Promise<unknown>>(),
}));

function baseGenerateResult(id: string) {
    return {
        content: [{ type: 'text' as const, text: `response from ${id}` }],
        finishReason: 'stop' as const,
        usage: { inputTokens: { total: 10 }, outputTokens: { total: 5 } },
        warnings: [],
    };
}

vi.mock('@openrouter/ai-sdk-provider', () => {
    function makeModel(id: string) {
        return {
            specificationVersion: 'v4' as const,
            provider: 'openrouter',
            modelId: id,
            supportedUrls: {},
            doGenerate: vi.fn(async () => {
                const override = modelOverrides.get(id);
                return override ? override() : baseGenerateResult(id);
            }),
            doStream: vi.fn(),
        };
    }
    return {
        createOpenRouter: vi.fn(() => (id: string) => makeModel(id)),
    };
});

vi.mock('@ai-sdk/openai', () => {
    function makeModel(id: string) {
        return {
            specificationVersion: 'v4' as const,
            provider: 'gateway',
            modelId: id,
            supportedUrls: {},
            doGenerate: vi.fn(async () => {
                const override = modelOverrides.get(id);
                return override ? override() : baseGenerateResult(id);
            }),
            doStream: vi.fn(),
        };
    }
    return {
        createOpenAI: vi.fn(() => ({ chat: (id: string) => makeModel(id) })),
    };
});

function createMockLogger() {
    return {
        child: vi.fn(() => createMockLogger()),
        debug: vi.fn(),
        error: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
    };
}

describe('createIntelligence', () => {
    beforeEach(() => {
        modelOverrides.clear();
    });

    describe('provider resolution', () => {
        test('throws a clear error listing available providers for an unknown provider', () => {
            const intelligence = createIntelligence({
                agents: { summarizer: { model: 'some-model', provider: 'unknown-provider' } },
                providers: { openrouter: { apiKey: 'key', type: 'openrouter' } },
            });

            expect(() => intelligence.model('summarizer')).toThrow(
                /Unknown provider "unknown-provider".*openrouter/,
            );
        });
    });

    describe('agent resolution', () => {
        test('throws a clear error listing available agents when the agent is unknown', () => {
            const intelligence = createIntelligence({
                agents: { summarizer: { model: 'some-model', provider: 'openrouter' } },
                providers: {},
            });

            expect(() => intelligence.model('typo')).toThrow(/summarizer/);
        });

        test('caches the model instance per agent name', () => {
            const intelligence = createIntelligence({
                agents: { summarizer: { model: 'model-a', provider: 'openrouter' } },
                providers: { openrouter: { apiKey: 'key', type: 'openrouter' } },
            });

            const first = intelligence.model('summarizer');
            const second = intelligence.model('summarizer');

            expect(first).toBe(second);
        });
    });

    describe('composition', () => {
        test('the resolved model is usable with generateText', async () => {
            const intelligence = createIntelligence({
                agents: { summarizer: { model: 'model-a', provider: 'openrouter' } },
                providers: { openrouter: { apiKey: 'key', type: 'openrouter' } },
            });

            const { text } = await generateText({
                model: intelligence.model('summarizer'),
                prompt: 'Hello!',
            });

            expect(text).toBe('response from model-a');
        });

        test('resolves gateway provider references', async () => {
            const intelligence = createIntelligence({
                agents: { summarizer: { model: 'model-b', provider: 'proxy' } },
                providers: {
                    proxy: { baseURL: 'https://proxy.example.com/v1', type: 'gateway' },
                },
            });

            const { text } = await generateText({
                model: intelligence.model('summarizer'),
                prompt: 'Hello!',
            });

            expect(text).toBe('response from model-b');
        });

        test('falls back to the configured fallback model on a retryable error', async () => {
            modelOverrides.set('flaky-model', async () => {
                throw new APICallError({
                    message: 'Service unavailable',
                    requestBodyValues: {},
                    statusCode: 503,
                    url: 'https://openrouter.ai',
                });
            });

            const intelligence = createIntelligence({
                agents: {
                    summarizer: {
                        fallback: { model: 'backup-model', provider: 'openrouter' },
                        model: 'flaky-model',
                        provider: 'openrouter',
                    },
                },
                providers: { openrouter: { apiKey: 'key', type: 'openrouter' } },
            });

            const { text } = await generateText({
                model: intelligence.model('summarizer'),
                prompt: 'Hello!',
            });

            expect(text).toBe('response from backup-model');
        });

        test('applies the logging middleware when a logger is provided', async () => {
            const logger = createMockLogger();
            const intelligence = createIntelligence({
                agents: { summarizer: { model: 'model-a', provider: 'openrouter' } },
                logger,
                providers: { openrouter: { apiKey: 'key', type: 'openrouter' } },
            });

            await generateText({ model: intelligence.model('summarizer'), prompt: 'Hello!' });

            expect(logger.debug).toHaveBeenCalledWith('ai.generate.start', expect.any(Object));
        });

        test('does not apply logging middleware when no logger is provided', async () => {
            const intelligence = createIntelligence({
                agents: { summarizer: { model: 'model-a', provider: 'openrouter' } },
                providers: { openrouter: { apiKey: 'key', type: 'openrouter' } },
            });

            // Then -- no error, and the model is a plain (unwrapped-by-logging) composition
            await expect(
                generateText({ model: intelligence.model('summarizer'), prompt: 'Hello!' }),
            ).resolves.toEqual(expect.objectContaining({ text: 'response from model-a' }));
        });
    });
});
