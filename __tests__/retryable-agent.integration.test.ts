import { afterAll, afterEach, beforeAll, describe, expect, it } from '@jterrazz/test';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { z } from 'zod/v4';

import { BasicAgentAdapter } from '../src/adapters/agents/basic-agent.adapter.js';
import { RetryableAgentAdapter } from '../src/adapters/agents/retryable-agent.adapter.js';
import { OpenRouterModelAdapter } from '../src/adapters/models/openrouter-model.adapter.js';
import { SystemPromptAdapter } from '../src/adapters/prompts/system-prompt.adapter.js';
import { UserPromptAdapter } from '../src/adapters/prompts/user-prompt.adapter.js';

// Mock server setup
const server = setupServer();

// Test data
const mockApiKey = 'test-api-key';
const mockModelName = 'google/gemini-2.5-flash-preview-05-20';

describe('RetryableAgentAdapter Integration Tests', () => {
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

        const model = new OpenRouterModelAdapter({
            apiKey: mockApiKey,
            modelName: mockModelName,
        });

        const systemPrompt = new SystemPromptAdapter('You are a helpful AI assistant.');

        const basicAgent = new BasicAgentAdapter('TestAgent', {
            model,
            systemPrompt,
        });

        const retryableAgent = new RetryableAgentAdapter(basicAgent, {
            retries: 3,
        });

        const userPrompt = new UserPromptAdapter('Hello, how are you?');

        // When - running the retryable agent
        const result = await retryableAgent.run(userPrompt);

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

        const model = new OpenRouterModelAdapter({
            apiKey: mockApiKey,
            modelName: mockModelName,
        });

        const systemPrompt = new SystemPromptAdapter('You are a helpful AI assistant.');

        const basicAgent = new BasicAgentAdapter('ParseFailAgent', {
            model,
            schema: responseSchema,
            systemPrompt,
        });

        const retryableAgent = new RetryableAgentAdapter(basicAgent, {
            retries: 2,
        });

        const userPrompt = new UserPromptAdapter('Generate a structured response.');

        // When - running the retryable agent
        const result = await retryableAgent.run(userPrompt);

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

        const model = new OpenRouterModelAdapter({
            apiKey: mockApiKey,
            modelName: mockModelName,
        });

        const systemPrompt = new SystemPromptAdapter('You are a helpful AI assistant.');

        const basicAgent = new BasicAgentAdapter('StringAgent', {
            model,
            schema: stringSchema,
            systemPrompt,
        });

        const retryableAgent = new RetryableAgentAdapter(basicAgent, {
            retries: 1,
        });

        const userPrompt = new UserPromptAdapter('Give me a simple response.');

        // When - running the retryable agent
        const result = await retryableAgent.run(userPrompt);

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

        const model = new OpenRouterModelAdapter({
            apiKey: mockApiKey,
            modelName: mockModelName,
        });

        const systemPrompt = new SystemPromptAdapter('You are a helpful AI assistant.');

        const basicAgent = new BasicAgentAdapter('NoInputAgent', {
            model,
            systemPrompt,
        });

        const retryableAgent = new RetryableAgentAdapter(basicAgent, {
            retries: 2,
        });

        // When - running the retryable agent without input
        const result = await retryableAgent.run();

        // Then - it should return the response for the default message
        expect(result).toBe('Proceeding with default instructions.');
    });

    it('should have a descriptive name that includes the wrapped agent name', async () => {
        // Given - a retryable agent wrapping a basic agent
        const model = new OpenRouterModelAdapter({
            apiKey: mockApiKey,
            modelName: mockModelName,
        });

        const systemPrompt = new SystemPromptAdapter('You are a helpful AI assistant.');

        const basicAgent = new BasicAgentAdapter('MyBasicAgent', {
            model,
            systemPrompt,
        });

        const retryableAgent = new RetryableAgentAdapter(basicAgent, {
            retries: 1,
        });

        // When - checking the agent name
        const agentName = retryableAgent.name;

        // Then - it should include both retryable and the wrapped agent name
        expect(agentName).toBe('Retryable(MyBasicAgent)');
    });
}); 