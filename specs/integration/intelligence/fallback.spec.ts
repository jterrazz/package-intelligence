import { http, openai } from '@jterrazz/test/stubs';
import { generateText, streamText } from 'ai';
import { describe, expect, test } from 'vitest';

import { createIntelligence } from '../../../src/index.js';
import { recordingLogger } from '../__setup__/logger.js';
import { GATEWAY_COMPLETIONS, OPENROUTER_COMPLETIONS, PROVIDERS } from '../__setup__/providers.js';
import { integration } from '../integration.specification.js';

const AGENTS = {
    summarizer: {
        fallback: { model: 'anthropic/claude-sonnet', provider: 'router' },
        model: 'primary-model',
        provider: 'gateway',
    },
};

describe('fallback', () => {
    test('a primary that answers 500 hands the generation to the fallback, and says so', async () => {
        // Given - a gateway answering 500 and OpenRouter answering, with a logger
        const { logger, records } = recordingLogger();
        const result = await integration
            .intercept(http.post(GATEWAY_COMPLETIONS), openai.error(500))
            .intercept({
                request: http.post(OPENROUTER_COMPLETIONS),
                required: true,
                response: openai.reply('Hello from the fallback'),
            })
            .call(async () => {
                const intelligence = createIntelligence({
                    agents: AGENTS,
                    logger,
                    providers: PROVIDERS,
                });
                const { text } = await generateText({
                    maxRetries: 0,
                    model: intelligence.model('summarizer'),
                    prompt: 'Say hello',
                });
                return { logs: records.filter(({ level }) => level === 'warn'), text };
            });

        // Then - the fallback's answer, and the warning naming both models and the primary's error
        expect(result.value).toMatch({
            logs: [
                {
                    event: 'ai.fallback.triggered',
                    level: 'warn',
                    meta: {
                        modelIds: ['primary-model', 'anthropic/claude-sonnet'],
                        error: 'OpenAI error (500)',
                    },
                },
            ],
            text: 'Hello from the fallback',
        });
    });

    test('a primary nothing answers hands the generation to the fallback', async () => {
        // Given - a gateway that cannot be reached, and OpenRouter answering
        const result = await integration
            .intercept(http.post(GATEWAY_COMPLETIONS), http.unreachable())
            .intercept(http.post(OPENROUTER_COMPLETIONS), openai.reply('Hello from the fallback'))
            .call(async () => {
                const intelligence = createIntelligence({ agents: AGENTS, providers: PROVIDERS });
                const { text } = await generateText({
                    maxRetries: 0,
                    model: intelligence.model('summarizer'),
                    prompt: 'Say hello',
                });
                return text;
            });

        // Then - the fallback's answer
        expect(result.value).toMatch('Hello from the fallback');
    });

    test('a primary that refuses the request is not retried on the fallback', async () => {
        // Given - a gateway answering 400, and OpenRouter declared never reached
        const result = await integration
            .intercept(
                http.post(GATEWAY_COMPLETIONS),
                openai.error(400, 'the request is malformed'),
            )
            .intercept(http.never(http.post(OPENROUTER_COMPLETIONS)))
            .call(async () => {
                const intelligence = createIntelligence({ agents: AGENTS, providers: PROVIDERS });
                return await generateText({
                    maxRetries: 0,
                    model: intelligence.model('summarizer'),
                    prompt: 'Say hello',
                });
            });

        // Then - the primary's refusal reaches the caller
        expect(result.error).toMatch(`the request is malformed`);
    });

    test('a streamed generation falls back the same way, and says so', async () => {
        // Given - a gateway answering 429, OpenRouter streaming its answer, and a logger
        const { logger, records } = recordingLogger();
        const result = await integration
            .intercept(http.post(GATEWAY_COMPLETIONS), openai.error(429))
            .intercept(
                http.post(OPENROUTER_COMPLETIONS),
                openai.stream(['Hello ', 'from ', 'the stream']),
            )
            .call(async () => {
                const intelligence = createIntelligence({
                    agents: AGENTS,
                    logger,
                    providers: PROVIDERS,
                });
                const stream = streamText({
                    maxRetries: 0,
                    model: intelligence.model('summarizer'),
                    prompt: 'Say hello',
                });
                const text = await stream.text;
                return { logs: records.filter(({ level }) => level === 'warn'), text };
            });

        // Then - the fallback's streamed answer, whole, and the warning naming both models
        expect(result.value).toMatch({
            logs: [
                {
                    event: 'ai.fallback.triggered',
                    level: 'warn',
                    meta: {
                        modelIds: ['primary-model', 'anthropic/claude-sonnet'],
                        error: 'OpenAI error (429)',
                    },
                },
            ],
            text: 'Hello from the stream',
        });
    });

    test('a refused stream is not retried on the fallback', async () => {
        // Given - a gateway answering 400 to the stream, and OpenRouter declared never reached
        const result = await integration
            .intercept(
                http.post(GATEWAY_COMPLETIONS),
                openai.error(400, 'the request is malformed'),
            )
            .intercept(http.never(http.post(OPENROUTER_COMPLETIONS)))
            .call(async () => {
                const intelligence = createIntelligence({ agents: AGENTS, providers: PROVIDERS });
                const errors: string[] = [];
                const stream = streamText({
                    maxRetries: 0,
                    model: intelligence.model('summarizer'),
                    onError: ({ error }) => {
                        errors.push(error instanceof Error ? error.message : String(error));
                    },
                    prompt: 'Say hello',
                });
                await stream.consumeStream();
                return errors;
            });

        // Then - the primary's refusal, reported once
        expect(result.value).toMatch(['the request is malformed']);
    });
});
