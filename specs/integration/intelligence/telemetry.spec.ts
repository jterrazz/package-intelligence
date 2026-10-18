import { http, openai } from '@jterrazz/test/stubs';
import { context, trace } from '@opentelemetry/api';
import { AsyncLocalStorageContextManager } from '@opentelemetry/context-async-hooks';
import {
    BasicTracerProvider,
    InMemorySpanExporter,
    SimpleSpanProcessor,
} from '@opentelemetry/sdk-trace-base';
import { generateText, streamText } from 'ai';
import { describe, expect, test } from 'vitest';

import { createIntelligence } from '../../../src/index.js';
import { recordingLogger } from '../__setup__/logger.js';
import { GATEWAY_COMPLETIONS, OPENROUTER_COMPLETIONS, PROVIDERS } from '../__setup__/providers.js';
import { integration } from '../integration.specification.js';

// outside: `openai.stream()` serves no usage, so the chunks a gateway streams, usage on the last, are written here.
function streamed(delta: object, usage?: object): { data: object } {
    return {
        data: {
            choices: [{ delta, finish_reason: usage === undefined ? null : 'stop', index: 0 }],
            created: 1_767_225_600,
            id: 'chatcmpl-1',
            model: 'primary-model',
            object: 'chat.completion.chunk',
            ...(usage === undefined ? {} : { usage }),
        },
    };
}

// invariant: the clock stands still, so every duration logged is zero.
const still = integration.with({ clock: '2026-01-01T09:00:00.000Z' });

type GenerationSpan = { agent: unknown; cost: unknown; model: unknown; name: string };

const exporter = new InMemorySpanExporter();

// invariant: the one file that registers a tracer, so every other spec runs on a host with none.
context.setGlobalContextManager(new AsyncLocalStorageContextManager().enable());
trace.setGlobalTracerProvider(
    new BasicTracerProvider({ spanProcessors: [new SimpleSpanProcessor(exporter)] }),
);

function generationSpans(): GenerationSpan[] {
    const spans = exporter
        .getFinishedSpans()
        .filter(({ attributes }) => attributes['gen_ai.operation.name'] === 'chat')
        .map(({ attributes, name }) => ({
            agent: attributes['gen_ai.agent.name'],
            cost: attributes['gen_ai.usage.cost'],
            model: attributes['gen_ai.request.model'],
            name,
        }));
    exporter.reset();
    return spans;
}

// outside: OpenRouter's answer carries the cost it charged in `usage.cost`, which `openai.reply()` does not write.
function openRouterAnswer(cost: number): object {
    return {
        choices: [
            { finish_reason: 'stop', index: 0, message: { content: 'Hello', role: 'assistant' } },
        ],
        created: 1_767_225_600,
        id: 'gen-1',
        model: 'anthropic/claude-sonnet',
        object: 'chat.completion',
        usage: { completion_tokens: 10, cost, prompt_tokens: 10, total_tokens: 20 },
    };
}

describe('telemetry', () => {
    test('a generation is traced under its agent, costed from the declared pricing', async () => {
        // Given - an agent on the gateway, priced per million tokens, answered with 10 tokens each way
        const result = await integration
            .intercept(http.post(GATEWAY_COMPLETIONS), openai.reply('Hello'))
            .call(async () => {
                const intelligence = createIntelligence({
                    agents: { summarizer: { model: 'primary-model', provider: 'gateway' } },
                    pricing: { 'gateway/primary-model': { input: 3, output: 15 } },
                    providers: PROVIDERS,
                });
                await generateText({
                    model: intelligence.model('summarizer'),
                    prompt: 'Say hello',
                });
                return generationSpans();
            });

        // Then - one model span, named after the agent, its cost 10 × 3 + 10 × 15 per million
        expect(result.value).toMatch([
            {
                agent: 'summarizer',
                cost: 0.00018,
                model: 'primary-model',
                name: 'summarizer',
            },
        ]);
    });

    test('the cost OpenRouter reports wins over the declared pricing', async () => {
        // Given - OpenRouter answering with the cost it charged, for an agent priced too
        const result = await integration
            .intercept(http.post(OPENROUTER_COMPLETIONS), http.json(openRouterAnswer(0.0042)))
            .call(async () => {
                const intelligence = createIntelligence({
                    agents: { writer: { model: 'anthropic/claude-sonnet', provider: 'router' } },
                    pricing: { 'router/anthropic/claude-sonnet': { input: 3, output: 15 } },
                    providers: PROVIDERS,
                });
                await generateText({ model: intelligence.model('writer'), prompt: 'Say hello' });
                return generationSpans();
            });

        // Then - the span carries the charged cost, not the estimate
        expect(result.value).toMatch([
            {
                agent: 'writer',
                cost: 0.0042,
                model: 'anthropic/claude-sonnet',
                name: 'writer',
            },
        ]);
    });

    test('a generation OpenRouter reports as free is costed from the declared pricing', async () => {
        // Given - OpenRouter answering with a cost of zero, for an agent priced per million tokens
        const result = await integration
            .intercept(http.post(OPENROUTER_COMPLETIONS), http.json(openRouterAnswer(0)))
            .call(async () => {
                const intelligence = createIntelligence({
                    agents: { writer: { model: 'anthropic/claude-sonnet', provider: 'router' } },
                    pricing: { 'router/anthropic/claude-sonnet': { input: 3, output: 15 } },
                    providers: PROVIDERS,
                });
                await generateText({ model: intelligence.model('writer'), prompt: 'Say hello' });
                return generationSpans();
            });

        // Then - the estimate, 10 × 3 + 10 × 15 per million: a zero is no reported cost
        expect(result.value).toMatch([
            {
                agent: 'writer',
                cost: 0.00018,
                model: 'anthropic/claude-sonnet',
                name: 'writer',
            },
        ]);
    });

    test('an agent with no pricing on a provider that reports none is traced without a cost', async () => {
        // Given - an unpriced agent on the gateway
        const result = await integration
            .intercept(http.post(GATEWAY_COMPLETIONS), openai.reply('Hello'))
            .call(async () => {
                const intelligence = createIntelligence({
                    agents: { summarizer: { model: 'primary-model', provider: 'gateway' } },
                    providers: PROVIDERS,
                });
                await generateText({
                    model: intelligence.model('summarizer'),
                    prompt: 'Say hello',
                });
                return generationSpans();
            });

        // Then - the span is named after the agent, and states no cost
        expect(result.value).toMatch([
            {
                agent: 'summarizer',
                model: 'primary-model',
                name: 'summarizer',
            },
        ]);
    });

    test('a second factory in the process traces a generation once', async () => {
        // Given - two factories built in one process, the second one generating
        const result = await integration
            .intercept(http.post(GATEWAY_COMPLETIONS), openai.reply('Hello'))
            .call(async () => {
                const config = {
                    agents: { summarizer: { model: 'primary-model', provider: 'gateway' } },
                    providers: PROVIDERS,
                };
                createIntelligence(config);
                const intelligence = createIntelligence(config);
                await generateText({
                    model: intelligence.model('summarizer'),
                    prompt: 'Say hello',
                });
                return generationSpans();
            });

        // Then - one model span: the AI SDK's telemetry is registered once per process
        expect(result.value).toMatch([
            {
                agent: 'summarizer',
                model: 'primary-model',
                name: 'summarizer',
            },
        ]);
    });

    test('a streamed generation is traced, costed and logged like a generated one', async () => {
        // Given - a priced agent on the gateway streaming its answer, its usage on the last chunk, with a logger
        const { logger, records } = recordingLogger();
        const result = await still
            .intercept(
                http.post(GATEWAY_COMPLETIONS),
                http.sse([
                    streamed({ content: 'Hel', role: 'assistant' }),
                    streamed({ content: 'lo' }),
                    streamed({}, { completion_tokens: 10, prompt_tokens: 10, total_tokens: 20 }),
                    { data: '[DONE]' },
                ]),
            )
            .call(async () => {
                const intelligence = createIntelligence({
                    agents: { summarizer: { model: 'primary-model', provider: 'gateway' } },
                    logger,
                    pricing: { 'gateway/primary-model': { input: 3, output: 15 } },
                    providers: PROVIDERS,
                });
                const stream = streamText({
                    model: intelligence.model('summarizer'),
                    prompt: 'Say hello',
                });
                const text = await stream.text;
                return { logs: records, spans: generationSpans(), text };
            });

        // Then - the text, the span under the agent costed from the last chunk's usage, and the stream's two log events
        expect(result.value).toMatch({
            logs: [
                {
                    event: 'ai.stream.start',
                    level: 'debug',
                    meta: {
                        model: 'primary-model',
                    },
                },
                {
                    event: 'ai.stream.complete',
                    level: 'debug',
                    meta: {
                        model: 'primary-model',
                        durationMs: 0,
                    },
                },
            ],
            spans: [
                {
                    agent: 'summarizer',
                    cost: 0.00018,
                    model: 'primary-model',
                    name: 'summarizer',
                },
            ],
            text: 'Hello',
        });
    });

    test('a logger hears each generation start and complete, with its usage', async () => {
        // Given - an agent on the gateway, with a logger
        const { logger, records } = recordingLogger();
        const result = await still
            .intercept(http.post(GATEWAY_COMPLETIONS), openai.reply('Hello'))
            .call(async () => {
                const intelligence = createIntelligence({
                    agents: { summarizer: { model: 'primary-model', provider: 'gateway' } },
                    logger,
                    providers: PROVIDERS,
                });
                await generateText({
                    model: intelligence.model('summarizer'),
                    prompt: 'Say hello',
                });
                return records;
            });

        // Then - the two events, whole
        expect(result.value).toMatch([
            {
                event: 'ai.generate.start',
                level: 'debug',
                meta: {
                    model: 'primary-model',
                },
            },
            {
                event: 'ai.generate.complete',
                level: 'debug',
                meta: {
                    model: 'primary-model',
                    durationMs: 0,
                    finishReason: {
                        unified: 'stop',
                        raw: 'stop',
                    },
                    usage: {
                        inputTokens: {
                            total: 10,
                            noCache: 10,
                            cacheRead: 0,
                        },
                        outputTokens: {
                            total: 10,
                            text: 10,
                            reasoning: 0,
                        },
                        raw: {
                            prompt_tokens: 10,
                            completion_tokens: 10,
                            total_tokens: 20,
                        },
                    },
                },
            },
        ]);
    });
});
