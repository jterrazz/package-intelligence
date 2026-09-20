import type { OpenAIProvider } from '@ai-sdk/openai';
import { APICallError } from '@ai-sdk/provider';
import type { OpenRouterProvider } from '@openrouter/ai-sdk-provider';
import { generateText } from 'ai';
import { describe, expect, test, vi } from 'vitest';

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

vi.mock(import('@openrouter/ai-sdk-provider'), () => {
    function makeModel(id: string) {
        return {
            specificationVersion: 'v4' as const,
            provider: 'openrouter',
            modelId: id,
            supportedUrls: {},
            doGenerate: vi.fn(async () => {
                const override = modelOverrides.get(id);
                return override ? await override() : baseGenerateResult(id);
            }),
            doStream: vi.fn(),
        };
    }
    return {
        createOpenRouter: vi.fn(
            () => ((id: string) => makeModel(id)) as unknown as OpenRouterProvider,
        ),
    };
});

vi.mock(import('@ai-sdk/openai'), () => {
    function makeModel(id: string) {
        return {
            specificationVersion: 'v4' as const,
            provider: 'gateway',
            modelId: id,
            supportedUrls: {},
            doGenerate: vi.fn(async () => {
                const override = modelOverrides.get(id);
                return override ? await override() : baseGenerateResult(id);
            }),
            doStream: vi.fn(),
        };
    }
    return {
        createOpenAI: vi.fn(
            () => ({ chat: (id: string) => makeModel(id) }) as unknown as OpenAIProvider,
        ),
    };
});

/**
 * Registers a model answer for the scope of ONE test and gives it back when
 * that scope ends, so the Given stays inside the test that needs it.
 */
function overrideModel(id: string, answer: () => Promise<unknown>): Disposable {
    modelOverrides.set(id, answer);
    return {
        [Symbol.dispose]() {
            modelOverrides.delete(id);
        },
    };
}

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
    describe('provider resolution', () => {
        test('throws a clear error listing available providers for an unknown provider', () => {
            // Given - an agent naming a provider the configuration does not declare
            const intelligence = createIntelligence({
                agents: { summarizer: { model: 'some-model', provider: 'unknown-provider' } },
                providers: { openrouter: { apiKey: 'key', type: 'openrouter' } },
            });

            // Then - resolving it names the unknown provider and the ones that exist
            expect(() => intelligence.model('summarizer')).toThrow(
                /Unknown provider "unknown-provider".*openrouter/u,
            );
        });
    });

    describe('agent resolution', () => {
        test('throws a clear error listing available agents when the agent is unknown', () => {
            // Given - a configuration declaring one agent
            const intelligence = createIntelligence({
                agents: { summarizer: { model: 'some-model', provider: 'openrouter' } },
                providers: {},
            });

            // Then - asking for another one names the agent that does exist
            expect(() => intelligence.model('typo')).toThrow(/summarizer/u);
        });

        test('caches the model instance per agent name', () => {
            // Given - a resolvable agent
            const intelligence = createIntelligence({
                agents: { summarizer: { model: 'model-a', provider: 'openrouter' } },
                providers: { openrouter: { apiKey: 'key', type: 'openrouter' } },
            });

            const first = intelligence.model('summarizer');
            const second = intelligence.model('summarizer');

            // Then - two resolutions hand back the same instance
            expect(first).toBe(second);
        });
    });

    describe('composition', () => {
        test('the resolved model is usable with generateText', async () => {
            // Given - an agent on an openrouter provider
            const intelligence = createIntelligence({
                agents: { summarizer: { model: 'model-a', provider: 'openrouter' } },
                providers: { openrouter: { apiKey: 'key', type: 'openrouter' } },
            });

            const { text } = await generateText({
                model: intelligence.model('summarizer'),
                prompt: 'Hello!',
            });

            // Then - the model answers through the ai SDK
            expect(text).toBe('response from model-a');
        });

        test('resolves gateway provider references', async () => {
            // Given - an agent on a gateway provider named by base URL
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

            // Then - the gateway model answers
            expect(text).toBe('response from model-b');
        });

        test('falls back to the configured fallback model on a retryable error', async () => {
            // Given - a primary model that raises a 503 and a declared fallback
            using _ = overrideModel('flaky-model', () => {
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

            // Then - the fallback model is the one that answers
            expect(text).toBe('response from backup-model');
        });

        test('applies the logging middleware when a logger is provided', async () => {
            // Given - a configuration carrying a logger
            const logger = createMockLogger();
            const intelligence = createIntelligence({
                agents: { summarizer: { model: 'model-a', provider: 'openrouter' } },
                logger,
                providers: { openrouter: { apiKey: 'key', type: 'openrouter' } },
            });

            await generateText({ model: intelligence.model('summarizer'), prompt: 'Hello!' });

            // Then - the logging middleware reports the generation
            expect(logger.debug).toHaveBeenCalledWith('ai.generate.start', expect.any(Object));
        });

        test('does not apply logging middleware when no logger is provided', async () => {
            // Given - a configuration carrying no logger
            const intelligence = createIntelligence({
                agents: { summarizer: { model: 'model-a', provider: 'openrouter' } },
                providers: { openrouter: { apiKey: 'key', type: 'openrouter' } },
            });

            // Then -- no error, and the model is a plain (unwrapped-by-logging) composition
            await expect(
                generateText({ model: intelligence.model('summarizer'), prompt: 'Hello!' }),
            ).resolves.toStrictEqual(expect.objectContaining({ text: 'response from model-a' }));
        });
    });
});
