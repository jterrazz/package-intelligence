import { afterAll, afterEach, beforeAll, describe, expect, it } from '@jterrazz/test';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { z } from 'zod/v4';

import { ChatAgent } from '../src/adapters/agents/chat-agent.adapter.js';
import { ResilientAgent } from '../src/adapters/agents/resilient-agent.adapter.js';
import { SystemPrompt } from '../src/adapters/prompts/system-prompt.adapter.js';
import { UserPrompt } from '../src/adapters/prompts/user-prompt.adapter.js';
import { OpenRouterProvider } from '../src/adapters/providers/openrouter-provider.adapter.js';

// Mock server setup
const server = setupServer();

// Test data
const mockApiKey = 'test-api-key';
const mockModelName = 'google/gemini-2.5-flash-preview-05-20';

describe('ResilientAgent Integration Tests', () => {
    beforeAll(() => {
        server.listen();
    });

    afterEach(() => {
        server.resetHandlers();
    });

    afterAll(() => {
        server.close();
    });

    it('should successfully execute without retries when first attempt succeeds', async () => {
        // Given - a retryable agent wrapping a basic agent and a successful API response
        server.use(
            http.post('https://openrouter.ai/api/v1/chat/completions', () => {
                return HttpResponse.json({
                    choices: [
                        {
                            index: 0,
                            message: {
                                content: 'Success on first try!',
                                role: 'assistant',
                            },
                        },
                    ],
                    id: 'test-response-id',
                    model: mockModelName,
                    object: 'chat.completion',
                });
            }),
        );

        const provider = new OpenRouterProvider({
            apiKey: mockApiKey,
        });
        const model = provider.getModel(mockModelName);

        const systemPrompt = new SystemPrompt('You are a helpful AI assistant.');

        const basicAgent = new ChatAgent('TestAgent', {
            model,
            systemPrompt,
        });

        const resilientAgent = new ResilientAgent(basicAgent, {
            retries: 3,
        });

        const userPrompt = new UserPrompt('Hello, how are you?');

        // When - running the resilient agent
        const result = await resilientAgent.run(userPrompt);

        // Then - it should return the expected response
        expect(result).toBe('Success on first try!');
    });

    it('should handle failed parsing and return null after retries', async () => {
        // Given - a retryable agent with schema that fails parsing on all attempts
        const responseSchema = z.object({
            confidence: z.number(),
            message: z.string(),
        });

        server.use(
            http.post('https://openrouter.ai/api/v1/chat/completions', () => {
                return HttpResponse.json({
                    choices: [
                        {
                            index: 0,
                            message: {
                                content: 'This will always fail parsing',
                                role: 'assistant',
                            },
                        },
                    ],
                    id: 'test-response-id',
                    model: mockModelName,
                    object: 'chat.completion',
                });
            }),
        );

        const provider = new OpenRouterProvider({
            apiKey: mockApiKey,
        });
        const model = provider.getModel(mockModelName);

        const systemPrompt = new SystemPrompt('You are a helpful AI assistant.');

        const basicAgent = new ChatAgent('ParseFailAgent', {
            model,
            schema: responseSchema,
            systemPrompt,
        });

        const resilientAgent = new ResilientAgent(basicAgent, {
            retries: 2,
        });

        const userPrompt = new UserPrompt('Generate a structured response.');

        // When - running the resilient agent
        const result = await resilientAgent.run(userPrompt);

        // Then - it should return null after all retries fail
        expect(result).toBeNull();
    });

    it('should work with primitive schema types', async () => {
        // Given - a retryable agent with string schema
        const stringSchema = z.string();

        server.use(
            http.post('https://openrouter.ai/api/v1/chat/completions', () => {
                return HttpResponse.json({
                    choices: [
                        {
                            index: 0,
                            message: {
                                content: 'Simple string response',
                                role: 'assistant',
                            },
                        },
                    ],
                    id: 'test-response-id',
                    model: mockModelName,
                    object: 'chat.completion',
                });
            }),
        );

        const provider = new OpenRouterProvider({
            apiKey: mockApiKey,
        });
        const model = provider.getModel(mockModelName);

        const systemPrompt = new SystemPrompt('You are a helpful AI assistant.');

        const basicAgent = new ChatAgent('StringAgent', {
            model,
            schema: stringSchema,
            systemPrompt,
        });

        const resilientAgent = new ResilientAgent(basicAgent, {
            retries: 1,
        });

        const userPrompt = new UserPrompt('Give me a simple response.');

        // When - running the resilient agent
        const result = await resilientAgent.run(userPrompt);

        // Then - it should return the string value
        expect(result).toBe('Simple string response');
    });

    it('should work without input prompt', async () => {
        // Given - a retryable agent and no input prompt
        server.use(
            http.post('https://openrouter.ai/api/v1/chat/completions', () => {
                return HttpResponse.json({
                    choices: [
                        {
                            index: 0,
                            message: {
                                content: 'Proceeding with default instructions.',
                                role: 'assistant',
                            },
                        },
                    ],
                    id: 'test-response-id',
                    model: mockModelName,
                    object: 'chat.completion',
                });
            }),
        );

        const provider = new OpenRouterProvider({
            apiKey: mockApiKey,
        });
        const model = provider.getModel(mockModelName);

        const systemPrompt = new SystemPrompt('You are a helpful AI assistant.');

        const basicAgent = new ChatAgent('NoInputAgent', {
            model,
            systemPrompt,
        });

        const resilientAgent = new ResilientAgent(basicAgent, {
            retries: 2,
        });

        // When - running the resilient agent without input
        const result = await resilientAgent.run();

        // Then - it should return the response for the default message
        expect(result).toBe('Proceeding with default instructions.');
    });

    it('should have a descriptive name that includes the wrapped agent name', async () => {
        // Given - a retryable agent wrapping a basic agent
        const provider = new OpenRouterProvider({
            apiKey: mockApiKey,
        });
        const model = provider.getModel(mockModelName);

        const systemPrompt = new SystemPrompt('You are a helpful AI assistant.');

        const basicAgent = new ChatAgent('MyChatAgent', {
            model,
            systemPrompt,
        });

        const resilientAgent = new ResilientAgent(basicAgent, {
            retries: 1,
        });

        // When - checking the agent name
        const agentName = resilientAgent.name;

        // Then - it should include both retryable and the wrapped agent name
        expect(agentName).toBe('Resilient(MyChatAgent)');
    });
});
