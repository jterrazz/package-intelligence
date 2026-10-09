import { http, openai } from '@jterrazz/test';
import { generateText } from 'ai';
import { describe, expect, test } from 'vitest';

import { createIntelligence } from '../../../src/index.js';
import { GATEWAY_COMPLETIONS, OPENROUTER_COMPLETIONS, PROVIDERS } from '../__setup__/providers.js';
import { integration } from '../integration.specification.js';

describe('resolution', () => {
    test('an agent on a gateway answers through its chat completions, under its model id', async () => {
        // Given - an agent on the gateway, which answers the model id the agent names
        const result = await integration
            .intercept({
                request: http.post(GATEWAY_COMPLETIONS, {
                    body: { model: 'primary-model' },
                    headers: { authorization: 'Bearer gateway-key' },
                }),
                required: true,
                response: openai.reply('Hello from the gateway'),
            })
            .call(async () => {
                const intelligence = createIntelligence({
                    agents: { summarizer: { model: 'primary-model', provider: 'gateway' } },
                    providers: PROVIDERS,
                });
                const { text } = await generateText({
                    model: intelligence.model('summarizer'),
                    prompt: 'Say hello',
                });
                return text;
            });

        // Then - the gateway's answer
        expect(result.value).toMatch('Hello from the gateway');
    });

    test('an agent on OpenRouter answers through OpenRouter, attributed to the application', async () => {
        // Given - an agent on OpenRouter, which answers a request carrying the application's attribution
        const result = await integration
            .intercept({
                request: http.post(OPENROUTER_COMPLETIONS, {
                    body: { model: 'anthropic/claude-sonnet' },
                    headers: {
                        authorization: 'Bearer router-key',
                        'http-referer': 'https://signews.test',
                        'x-openrouter-title': 'Signews',
                    },
                }),
                required: true,
                response: openai.reply('Hello from OpenRouter'),
            })
            .call(async () => {
                const intelligence = createIntelligence({
                    agents: { writer: { model: 'anthropic/claude-sonnet', provider: 'router' } },
                    providers: PROVIDERS,
                });
                const { text } = await generateText({
                    model: intelligence.model('writer'),
                    prompt: 'Say hello',
                });
                return text;
            });

        // Then - OpenRouter's answer
        expect(result.value).toMatch('Hello from OpenRouter');
    });

    test('a gateway named without a key is called with no token, whatever the process holds', async () => {
        // Given - a gateway declared by its address alone, which answers only a call bearing no token
        const result = await integration
            .intercept({
                request: http.post(GATEWAY_COMPLETIONS, { headers: { authorization: 'Bearer' } }),
                required: true,
                response: openai.reply('Hello from an open gateway'),
            })
            .call(async () => {
                const intelligence = createIntelligence({
                    agents: { summarizer: { model: 'primary-model', provider: 'open' } },
                    providers: { open: { baseURL: 'http://gateway.test/v1', type: 'gateway' } },
                });
                const { text } = await generateText({
                    model: intelligence.model('summarizer'),
                    prompt: 'Say hello',
                });
                return text;
            });

        // Then - the gateway's answer
        expect(result.value).toMatch('Hello from an open gateway');
    });

    test('an OpenRouter provider declared without metadata sends no attribution', async () => {
        // Given - OpenRouter declared by its key alone, which answers only a call carrying no attribution
        const result = await integration
            .intercept({
                request: http.post(OPENROUTER_COMPLETIONS, {
                    without: { headers: ['http-referer', 'x-openrouter-title'] },
                }),
                required: true,
                response: openai.reply('Hello, anonymously'),
            })
            .call(async () => {
                const intelligence = createIntelligence({
                    agents: { writer: { model: 'anthropic/claude-sonnet', provider: 'router' } },
                    providers: { router: { apiKey: 'router-key', type: 'openrouter' } },
                });
                const { text } = await generateText({
                    model: intelligence.model('writer'),
                    prompt: 'Say hello',
                });
                return text;
            });

        // Then - OpenRouter's answer
        expect(result.value).toMatch('Hello, anonymously');
    });

    test('a priced agent answers on a host that registered no OpenTelemetry SDK', async () => {
        // Given - a priced agent, in a process with no tracer: no span is ever active
        const result = await integration
            .intercept(http.post(GATEWAY_COMPLETIONS), openai.reply('Hello, untraced'))
            .call(async () => {
                const intelligence = createIntelligence({
                    agents: { summarizer: { model: 'primary-model', provider: 'gateway' } },
                    pricing: { 'gateway/primary-model': { input: 3, output: 15 } },
                    providers: PROVIDERS,
                });
                const { text } = await generateText({
                    model: intelligence.model('summarizer'),
                    prompt: 'Say hello',
                });
                return text;
            });

        // Then - the answer, the agent's name and its cost written nowhere
        expect(result.value).toMatch('Hello, untraced');
    });

    test('an agent the configuration does not declare is refused, naming the agents it does', async () => {
        // Given - a configuration declaring two agents, asked for a third
        const result = await integration.call(() =>
            createIntelligence({
                agents: {
                    summarizer: { model: 'primary-model', provider: 'gateway' },
                    writer: { model: 'anthropic/claude-sonnet', provider: 'router' },
                },
                providers: PROVIDERS,
            }).model('typo'),
        );

        // Then - the refusal names the agent asked for and the two that exist
        expect(result.error).toMatch('Unknown agent "typo". Available agents: summarizer, writer.');
    });

    test('an agent on a provider the configuration does not declare is refused, naming the providers it does', async () => {
        // Given - an agent naming a provider absent from the configuration
        const result = await integration.call(() =>
            createIntelligence({
                agents: { summarizer: { model: 'primary-model', provider: 'bedrock' } },
                providers: PROVIDERS,
            }).model('summarizer'),
        );

        // Then - the refusal names the provider asked for and the two that exist
        expect(result.error).toMatch(
            'Unknown provider "bedrock". Available providers: gateway, router.',
        );
    });

    test('a configuration with no agent and no provider says so when asked for one', async () => {
        // Given - an empty configuration, asked for an agent, and one whose agent names a provider it lacks
        const noAgent = await integration.call(() =>
            createIntelligence({ agents: {}, providers: {} }).model('summarizer'),
        );
        const noProvider = await integration.call(() =>
            createIntelligence({
                agents: { summarizer: { model: 'primary-model', provider: 'gateway' } },
                providers: {},
            }).model('summarizer'),
        );

        // Then - each refusal says nothing is configured
        expect(noAgent.error).toMatch(
            'Unknown agent "summarizer". Available agents: (none configured).',
        );
        expect(noProvider.error).toMatch(
            'Unknown provider "gateway". Available providers: (none configured).',
        );
    });

    test('an agent is resolved once: asking again hands back the same model', async () => {
        // Given - one agent, resolved twice
        const result = await integration.call(() => {
            const intelligence = createIntelligence({
                agents: { summarizer: { model: 'primary-model', provider: 'gateway' } },
                providers: PROVIDERS,
            });
            const first = intelligence.model('summarizer');
            const second = intelligence.model('summarizer');
            return first === second;
        });

        // Then - one instance
        expect(result.value).toMatch(true);
    });
});
