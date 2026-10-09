import { http, openai } from '@jterrazz/test';
import { generateText, Output, wrapLanguageModel } from 'ai';
import type { ModelMessage } from 'ai';
import { describe, expect, test } from 'vitest';
import { z } from 'zod';

import { createOpenRouterProvider, createSchemaInstructionMiddleware } from '../../../src/index.js';
import { OPENROUTER_COMPLETIONS } from '../__setup__/providers.js';
import { integration } from '../integration.specification.js';

const ECHOED = z.object({ messages: z.array(z.unknown()) });

// outside: the provider answers with the messages it was sent, so the spec reads what the middleware made of the prompt.
const echo = {
    request: http.post(OPENROUTER_COMPLETIONS),
    response: ({ body }: { body: unknown }) => {
        const messages: unknown = Reflect.get(new Object(body), 'messages');
        return openai.reply({ messages });
    },
};

async function sent(prompt: ModelMessage[] | string, instructions?: string): Promise<unknown> {
    const model = wrapLanguageModel({
        middleware: [createSchemaInstructionMiddleware()],
        model: createOpenRouterProvider({ apiKey: 'router-key' }).model('anthropic/claude-sonnet'),
    });
    const { output } = await generateText({
        model,
        output: Output.object({ schema: ECHOED }),
        ...(instructions === undefined ? {} : { instructions }),
        ...(typeof prompt === 'string' ? { prompt } : { messages: prompt }),
    });
    return output;
}

describe('prompt', () => {
    test('a structured request carries the schema at the end of its user message', async () => {
        // Given - a one-line prompt asking for an object
        const result = await integration
            .intercept(echo)
            .call(async () => await sent('Summarize the weather'));

        // Then - the user message, the instruction and the schema after a blank line
        expect(result.value).toMatch({
            messages: [
                {
                    role: 'user',
                    content:
                        'Summarize the weather\n\nYou must respond with valid JSON only — no prose, no markdown code fences.\nThe JSON must strictly conform to this JSON schema:\n{"$schema":"http://json-schema.org/draft-07/schema#","type":"object","properties":{"messages":{"type":"array","items":{}}},"required":["messages"],"additionalProperties":false}',
                },
            ],
        });
    });

    test('only the last user message of a conversation carries the instruction', async () => {
        // Given - a system message, a first question, its answer, and a second question
        const result = await integration.intercept(echo).call(
            async () =>
                await sent(
                    [
                        { content: 'First question', role: 'user' },
                        { content: 'First answer', role: 'assistant' },
                        { content: 'Second question', role: 'user' },
                    ],
                    'You summarize.',
                ),
        );

        // Then - the system message and the first exchange as they were, the second question instructed
        expect(result.value).toMatch({
            messages: [
                {
                    role: 'system',
                    content: [
                        {
                            type: 'text',
                            text: 'You summarize.',
                        },
                    ],
                },
                {
                    role: 'user',
                    content: 'First question',
                },
                {
                    role: 'assistant',
                    content: 'First answer',
                },
                {
                    role: 'user',
                    content:
                        'Second question\n\nYou must respond with valid JSON only — no prose, no markdown code fences.\nThe JSON must strictly conform to this JSON schema:\n{"$schema":"http://json-schema.org/draft-07/schema#","type":"object","properties":{"messages":{"type":"array","items":{}}},"required":["messages"],"additionalProperties":false}',
                },
            ],
        });
    });

    test('a conversation with no user message gets one, holding the instruction', async () => {
        // Given - instructions and an assistant's message, and no user message
        const result = await integration
            .intercept(echo)
            .call(
                async () =>
                    await sent(
                        [{ content: 'Earlier answer', role: 'assistant' }],
                        'You summarize.',
                    ),
            );

        // Then - the system message and the assistant's, then a user message of the instruction alone
        expect(result.value).toMatch({
            messages: [
                {
                    role: 'system',
                    content: [
                        {
                            type: 'text',
                            text: 'You summarize.',
                        },
                    ],
                },
                {
                    role: 'assistant',
                    content: 'Earlier answer',
                },
                {
                    role: 'user',
                    content:
                        'You must respond with valid JSON only — no prose, no markdown code fences.\nThe JSON must strictly conform to this JSON schema:\n{"$schema":"http://json-schema.org/draft-07/schema#","type":"object","properties":{"messages":{"type":"array","items":{}}},"required":["messages"],"additionalProperties":false}',
                },
            ],
        });
    });

    test('a user message of an image alone gets the instruction as a text beside it', async () => {
        // Given - a user message holding one image and no text
        const result = await integration.intercept(echo).call(
            async () =>
                await sent([
                    {
                        content: [
                            {
                                data: new URL('https://images.test/rain.png'),
                                mediaType: 'image/png',
                                type: 'file',
                            },
                        ],
                        role: 'user',
                    },
                ]),
        );

        // Then - the image, then the instruction as a second part
        expect(result.value).toMatch({
            messages: [
                {
                    role: 'user',
                    content: [
                        {
                            type: 'image_url',
                            image_url: {
                                url: 'https://images.test/rain.png',
                            },
                        },
                        {
                            type: 'text',
                            text: 'You must respond with valid JSON only — no prose, no markdown code fences.\nThe JSON must strictly conform to this JSON schema:\n{"$schema":"http://json-schema.org/draft-07/schema#","type":"object","properties":{"messages":{"type":"array","items":{}}},"required":["messages"],"additionalProperties":false}',
                        },
                    ],
                },
            ],
        });
    });

    test('the instruction goes after the last text of a user message, before an image that follows it', async () => {
        // Given - a user message of two texts around an image
        const result = await integration.intercept(echo).call(
            async () =>
                await sent([
                    {
                        content: [
                            { text: 'Describe this', type: 'text' },
                            {
                                data: new URL('https://images.test/rain.png'),
                                mediaType: 'image/png',
                                type: 'file',
                            },
                            { text: 'in one line', type: 'text' },
                        ],
                        role: 'user',
                    },
                ]),
        );

        // Then - the second text carries the instruction, the first and the image as they were
        expect(result.value).toMatch({
            messages: [
                {
                    role: 'user',
                    content: [
                        {
                            type: 'text',
                            text: 'Describe this',
                        },
                        {
                            type: 'image_url',
                            image_url: {
                                url: 'https://images.test/rain.png',
                            },
                        },
                        {
                            type: 'text',
                            text: 'in one line\n\nYou must respond with valid JSON only — no prose, no markdown code fences.\nThe JSON must strictly conform to this JSON schema:\n{"$schema":"http://json-schema.org/draft-07/schema#","type":"object","properties":{"messages":{"type":"array","items":{}}},"required":["messages"],"additionalProperties":false}',
                        },
                    ],
                },
            ],
        });
    });

    test('a JSON request with no schema is told to answer JSON, and names no schema', async () => {
        // Given - a request for any JSON value
        const result = await integration.intercept(echo).call(async () => {
            const model = wrapLanguageModel({
                middleware: [createSchemaInstructionMiddleware()],
                model: createOpenRouterProvider({ apiKey: 'router-key' }).model(
                    'anthropic/claude-sonnet',
                ),
            });
            const { output } = await generateText({
                model,
                output: Output.json(),
                prompt: 'Summarize the weather',
            });
            return ECHOED.parse(output);
        });

        // Then - the user message and the instruction alone
        expect(result.value).toMatch({
            messages: [
                {
                    role: 'user',
                    content:
                        'Summarize the weather\n\nYou must respond with valid JSON only — no prose, no markdown code fences.',
                },
            ],
        });
    });

    test('a text request is sent as written', async () => {
        // Given - a request that asks for no structure
        const result = await integration.intercept(echo).call(async () => {
            const model = wrapLanguageModel({
                middleware: [createSchemaInstructionMiddleware()],
                model: createOpenRouterProvider({ apiKey: 'router-key' }).model(
                    'anthropic/claude-sonnet',
                ),
            });
            const { text } = await generateText({ model, prompt: 'Summarize the weather' });
            return text;
        });

        // Then - the one user message, untouched
        expect(result.value).toMatch(
            `{"messages":[{"role":"user","content":"Summarize the weather"}]}`,
        );
    });
});
