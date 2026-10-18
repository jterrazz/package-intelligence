import { http, openai } from '@jterrazz/test/stubs';
import { generateText, streamText, wrapLanguageModel } from 'ai';
import { describe, expect, test } from 'vitest';

import { createLoggingMiddleware, createOpenRouterProvider } from '../../../src/index.js';
import { recordingLogger } from '../__setup__/logger.js';
import { OPENROUTER_COMPLETIONS } from '../__setup__/providers.js';
import { integration } from '../integration.specification.js';

// invariant: the clock stands still, so every duration logged is zero.
const still = integration.with({ clock: '2026-01-01T09:00:00.000Z' });

function logged() {
    const { logger, records } = recordingLogger();
    const model = wrapLanguageModel({
        middleware: [createLoggingMiddleware({ logger })],
        model: createOpenRouterProvider({ apiKey: 'router-key' }).model('anthropic/claude-sonnet'),
    });
    return { model, records };
}

describe('errors', () => {
    test('a refused generation is logged as an error, and reaches the caller', async () => {
        // Given - a provider refusing the request
        const { model, records } = logged();
        const result = await still
            .intercept(
                http.post(OPENROUTER_COMPLETIONS),
                openai.error(400, 'the request is malformed'),
            )
            .call(async () => await generateText({ maxRetries: 0, model, prompt: 'Say hello' }));

        // Then - the refusal reaches the caller, after the start and the error were logged, durations aside
        expect(result.error).toMatch('the request is malformed');
        expect(
            records.map(({ event, level, meta }) => ({ event, level, error: meta?.error })),
        ).toStrictEqual([
            { error: undefined, event: 'ai.generate.start', level: 'debug' },
            { error: 'the request is malformed', event: 'ai.generate.error', level: 'error' },
        ]);
    });

    test('a refused stream is logged as an error, and reaches the caller', async () => {
        // Given - a provider refusing the streamed request
        const { model, records } = logged();
        const result = await still
            .intercept(
                http.post(OPENROUTER_COMPLETIONS),
                openai.error(400, 'the request is malformed'),
            )
            .call(async () => {
                const stream = streamText({
                    maxRetries: 0,
                    model,
                    onError: () => undefined,
                    prompt: 'Say hello',
                });
                await stream.consumeStream();
                return records;
            });

        // Then - the start and error events
        expect(result.value).toMatch([
            {
                event: 'ai.stream.start',
                level: 'debug',
                meta: {
                    model: 'anthropic/claude-sonnet',
                },
            },
            {
                event: 'ai.stream.error',
                level: 'error',
                meta: {
                    durationMs: 0,
                    model: 'anthropic/claude-sonnet',
                    error: 'the request is malformed',
                },
            },
        ]);
    });
});
