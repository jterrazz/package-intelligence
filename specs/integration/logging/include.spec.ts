import { http, openai } from '@jterrazz/test/stubs';
import { generateText, streamText, wrapLanguageModel } from 'ai';
import { describe, expect, test } from 'vitest';

import { createLoggingMiddleware, createOpenRouterProvider } from '../../../src/index.js';
import type { LoggingMiddlewareOptions } from '../../../src/index.js';
import { recordingLogger } from '../__setup__/logger.js';
import { OPENROUTER_COMPLETIONS } from '../__setup__/providers.js';
import { integration } from '../integration.specification.js';

// invariant: the clock stands still, so every duration logged is zero.
const still = integration.with({ clock: '2026-01-01T09:00:00.000Z' });

function logged(include: NonNullable<LoggingMiddlewareOptions['include']>) {
    const { logger, records } = recordingLogger();
    const model = wrapLanguageModel({
        middleware: [createLoggingMiddleware({ include, logger })],
        model: createOpenRouterProvider({ apiKey: 'router-key' }).model('anthropic/claude-sonnet'),
    });
    return { model, records };
}

describe('include', () => {
    test('a generation logs its prompt and its answer when asked, and leaves its usage out when told', async () => {
        // Given - the logger asked for the call's params and content, and not for its usage
        const result = await still
            .intercept(http.post(OPENROUTER_COMPLETIONS), openai.reply('Hello'))
            .call(async () => {
                const { model, records } = logged({ content: true, params: true, usage: false });
                await generateText({ model, prompt: 'Say hello' });
                return records.map(({ event, meta }) => {
                    const prompt: unknown = Reflect.get(new Object(meta?.params), 'prompt');
                    return {
                        content: meta?.content,
                        event,
                        fields: Object.keys(meta ?? {}).toSorted(),
                        prompt,
                    };
                });
            });

        // Then - the prompt on the start, the answer on the completion, no usage anywhere
        expect(result.value).toMatch([
            {
                event: 'ai.generate.start',
                fields: ['model', 'params'],
                prompt: [
                    {
                        role: 'user',
                        content: [
                            {
                                type: 'text',
                                text: 'Say hello',
                            },
                        ],
                    },
                ],
            },
            {
                event: 'ai.generate.complete',
                fields: ['content', 'durationMs', 'finishReason', 'model'],
                content: 'Hello',
            },
        ]);
    });

    test('the answer logged is its text alone, never its reasoning', async () => {
        // Given - the logger asked for content, and a provider answering with its reasoning beside its text
        const result = await still
            .intercept(
                http.post(OPENROUTER_COMPLETIONS),
                http.json({
                    choices: [
                        {
                            finish_reason: 'stop',
                            index: 0,
                            message: {
                                content: 'Hello',
                                reasoning: 'A greeting is asked.',
                                role: 'assistant',
                            },
                        },
                    ],
                    created: 1_767_225_600,
                    id: 'gen-1',
                    model: 'anthropic/claude-sonnet',
                    object: 'chat.completion',
                    usage: { completion_tokens: 10, prompt_tokens: 10, total_tokens: 20 },
                }),
            )
            .call(async () => {
                const { model, records } = logged({ content: true });
                await generateText({ model, prompt: 'Say hello' });
                return records.map(({ meta }) => meta?.content);
            });

        // Then - nothing on the start, the text alone on the completion
        expect(result.value).toMatch([null, 'Hello']);
    });

    test('a stream logs the text it streamed when asked', async () => {
        // Given - the logger asked for content, and a provider streaming its answer in two pieces
        const result = await still
            .intercept(http.post(OPENROUTER_COMPLETIONS), openai.stream(['Hel', 'lo']))
            .call(async () => {
                const { model, records } = logged({ content: true });
                await streamText({ model, prompt: 'Say hello' }).text;
                return records;
            });

        // Then - the start, and the completion carrying the whole text
        expect(result.value).toMatch([
            {
                event: 'ai.stream.start',
                level: 'debug',
                meta: {
                    model: 'anthropic/claude-sonnet',
                },
            },
            {
                event: 'ai.stream.complete',
                level: 'debug',
                meta: {
                    durationMs: 0,
                    model: 'anthropic/claude-sonnet',
                    content: 'Hello',
                },
            },
        ]);
    });
});
