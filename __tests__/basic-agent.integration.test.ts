import { afterAll, afterEach, beforeAll, describe, expect, it } from '@jterrazz/test';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { z } from 'zod/v4';

import { BasicAgentAdapter } from '../src/adapters/agents/basic-agent.adapter.js';
import { OpenRouterModelAdapter } from '../src/adapters/models/openrouter-model.adapter.js';
import { SystemPromptAdapter } from '../src/adapters/prompts/system-prompt.adapter.js';
import { UserPromptAdapter } from '../src/adapters/prompts/user-prompt.adapter.js';

// Type definitions for OpenAI chat completion requests
interface ChatCompletionMessage {
    content: string;
    role: 'assistant' | 'system' | 'user';
}

interface ChatCompletionRequest {
    [key: string]: unknown;
    max_tokens?: number;
    messages: ChatCompletionMessage[];
    model: string;
    temperature?: number;
}

// Mock server setup
const server = setupServer();

// Test data
const mockApiKey = 'test-api-key';
const mockModelName = 'google/gemini-2.5-flash-preview-05-20';

describe('BasicAgentAdapter Integration Tests', () => {
    beforeAll(() => {
        server.listen();
    });

    afterEach(() => {
        server.resetHandlers();
    });

    afterAll(() => {
        server.close();
    });

    it('should successfully execute a basic query without schema', async () => {
        // Given - a basic agent and a successful API response
        server.use(
            http.post('https://openrouter.ai/api/v1/chat/completions', async ({ request }) => {
                const body = (await request.json()) as ChatCompletionRequest;

                // Verify the complete request structure
                expect(body.messages).toHaveLength(2);
                expect(body.messages[0].role).toBe('system');
                expect(body.messages[1].role).toBe('user');
                expect(body.messages[1].content).toBe('Hello, how are you?');
                expect(body.model).toBe(mockModelName);

                // Verify the system prompt is exactly what we expect (no schema additions)
                expect(body.messages[0].content).toBe('You are a helpful AI assistant.');

                return HttpResponse.json({
                    choices: [
                        {
                            message: {
                                content: 'Hello! I am an AI assistant ready to help you.',
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

        const agent = new BasicAgentAdapter('TestAgent', {
            model,
            systemPrompt,
        });

        const userPrompt = new UserPromptAdapter('Hello, how are you?');

        // When - running the agent
        const result = await agent.run(userPrompt);

        // Then - it should return the expected response
        expect(result).toBe('Hello! I am an AI assistant ready to help you.');
    });

    it('should include complete JSON schema instructions in system prompt', async () => {
        // Given - a basic agent with complex object schema
        const responseSchema = z.object({
            confidence: z.number().min(0).max(1),
            message: z.string(),
            metadata: z.object({
                category: z.string(),
                tags: z.array(z.string()),
            }),
        });

        const expectedSystemPrompt = `You are a helpful AI assistant that responds with structured data.

<OUTPUT_FORMAT>
You must respond with valid JSON that matches this JSON schema description:

\`\`\`json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "confidence": {
      "type": "number",
      "minimum": 0,
      "maximum": 1
    },
    "message": {
      "type": "string"
    },
    "metadata": {
      "type": "object",
      "properties": {
        "category": {
          "type": "string"
        },
        "tags": {
          "type": "array",
          "items": {
            "type": "string"
          }
        }
      },
      "required": [
        "category",
        "tags"
      ],
      "additionalProperties": false
    }
  },
  "required": [
    "confidence",
    "message",
    "metadata"
  ],
  "additionalProperties": false
}
\`\`\`

Your response must be parseable JSON that validates against this schema. Do not include any text outside the JSON.
</OUTPUT_FORMAT>`;

        server.use(
            http.post('https://openrouter.ai/api/v1/chat/completions', async ({ request }) => {
                const body = (await request.json()) as ChatCompletionRequest;

                // Verify the complete system prompt matches exactly
                expect(body.messages[0].content).toBe(expectedSystemPrompt);

                // Verify other request structure
                expect(body.messages).toHaveLength(2);
                expect(body.messages[0].role).toBe('system');
                expect(body.messages[1].role).toBe('user');
                expect(body.messages[1].content).toBe('Generate a structured response.');
                expect(body.model).toBe(mockModelName);

                return HttpResponse.json({
                    choices: [
                        {
                            message: {
                                content: JSON.stringify({
                                    confidence: 0.95,
                                    message: 'This is a structured response',
                                    metadata: {
                                        category: 'test',
                                        tags: ['structured', 'response'],
                                    },
                                }),
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

        const systemPrompt = new SystemPromptAdapter(
            'You are a helpful AI assistant that responds with structured data.',
        );

        const agent = new BasicAgentAdapter('SchemaAgent', {
            model,
            schema: responseSchema,
            systemPrompt,
        });

        const userPrompt = new UserPromptAdapter('Generate a structured response.');

        // When - running the agent
        const result = await agent.run(userPrompt);

        // Then - it should return the parsed object
        expect(result).toEqual({
            confidence: 0.95,
            message: 'This is a structured response',
            metadata: {
                category: 'test',
                tags: ['structured', 'response'],
            },
        });
    });

    it('should include complete primitive schema instructions in system prompt', async () => {
        // Given - a basic agent with string schema
        const stringSchema = z.string().min(5).max(100);

        const expectedSystemPrompt = `You are a helpful AI assistant.

<OUTPUT_FORMAT>
You must respond with a string value that matches this schema:

\`\`\`json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "string",
  "minLength": 5,
  "maxLength": 100
}
\`\`\`

Your response should be only the string value, without any JSON wrapping or additional text.
</OUTPUT_FORMAT>`;

        server.use(
            http.post('https://openrouter.ai/api/v1/chat/completions', async ({ request }) => {
                const body = (await request.json()) as ChatCompletionRequest;

                // Verify the complete system prompt matches exactly
                expect(body.messages[0].content).toBe(expectedSystemPrompt);

                // Verify other request structure
                expect(body.messages).toHaveLength(2);
                expect(body.messages[0].role).toBe('system');
                expect(body.messages[1].role).toBe('user');
                expect(body.messages[1].content).toBe('Give me a simple response.');
                expect(body.model).toBe(mockModelName);

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

        const agent = new BasicAgentAdapter('StringAgent', {
            model,
            schema: stringSchema,
            systemPrompt,
        });

        const userPrompt = new UserPromptAdapter('Give me a simple response.');

        // When - running the agent
        const result = await agent.run(userPrompt);

        // Then - it should return the string value
        expect(result).toBe('Simple string response');
    });

    it('should handle different user prompts with conditional responses', async () => {
        // Given - a basic agent with conditional mock responses based on user input
        server.use(
            http.post('https://openrouter.ai/api/v1/chat/completions', async ({ request }) => {
                const body = (await request.json()) as ChatCompletionRequest;
                const userMessage = body.messages[1].content;

                // Verify the complete request structure for each call
                expect(body.messages).toHaveLength(2);
                expect(body.messages[0].role).toBe('system');
                expect(body.messages[1].role).toBe('user');
                expect(body.model).toBe(mockModelName);

                // Return different responses based on user input
                if (userMessage.includes('weather')) {
                    expect(userMessage).toBe('What is the weather like?');
                    return HttpResponse.json({
                        choices: [
                            {
                                message: {
                                    content: 'The weather is sunny today!',
                                    role: 'assistant',
                                },
                            },
                        ],
                        id: 'weather-response-id',
                        model: mockModelName,
                        object: 'chat.completion',
                    });
                } else if (userMessage.includes('time')) {
                    expect(userMessage).toBe('What time is it?');
                    return HttpResponse.json({
                        choices: [
                            {
                                message: {
                                    content: 'It is currently 3:00 PM.',
                                    role: 'assistant',
                                },
                            },
                        ],
                        id: 'time-response-id',
                        model: mockModelName,
                        object: 'chat.completion',
                    });
                } else {
                    expect(userMessage).toBe('Tell me a joke.');
                    return HttpResponse.json({
                        choices: [
                            {
                                message: {
                                    content: 'I can help with weather or time questions.',
                                    role: 'assistant',
                                },
                            },
                        ],
                        id: 'default-response-id',
                        model: mockModelName,
                        object: 'chat.completion',
                    });
                }
            }),
        );

        const model = new OpenRouterModelAdapter({
            apiKey: mockApiKey,
            modelName: mockModelName,
        });

        const systemPrompt = new SystemPromptAdapter('You are a helpful AI assistant.');

        const agent = new BasicAgentAdapter('ConditionalAgent', {
            model,
            systemPrompt,
        });

        // When - testing weather question
        const weatherPrompt = new UserPromptAdapter('What is the weather like?');
        const weatherResult = await agent.run(weatherPrompt);

        // Then - it should return weather response
        expect(weatherResult).toBe('The weather is sunny today!');

        // When - testing time question
        const timePrompt = new UserPromptAdapter('What time is it?');
        const timeResult = await agent.run(timePrompt);

        // Then - it should return time response
        expect(timeResult).toBe('It is currently 3:00 PM.');

        // When - testing other question
        const otherPrompt = new UserPromptAdapter('Tell me a joke.');
        const otherResult = await agent.run(otherPrompt);

        // Then - it should return default response
        expect(otherResult).toBe('I can help with weather or time questions.');
    });

    it('should handle invalid JSON response with schema gracefully', async () => {
        // Given - a basic agent with schema and an invalid JSON response
        const responseSchema = z.object({
            confidence: z.number(),
            message: z.string(),
        });

        server.use(
            http.post('https://openrouter.ai/api/v1/chat/completions', async ({ request }) => {
                const body = (await request.json()) as ChatCompletionRequest;

                // Verify the user prompt is about generating invalid response
                expect(body.messages[1].content).toBe('Generate invalid response.');

                // Verify schema instructions are present even for invalid response test
                const systemPrompt = body.messages[0].content;
                expect(systemPrompt).toContain('OUTPUT_FORMAT');
                expect(systemPrompt).toContain('valid JSON');

                return HttpResponse.json({
                    choices: [
                        {
                            message: {
                                content: 'This is not valid JSON for the schema',
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

        const agent = new BasicAgentAdapter('InvalidJsonAgent', {
            model,
            schema: responseSchema,
            systemPrompt,
        });

        const userPrompt = new UserPromptAdapter('Generate invalid response.');

        // When - running the agent
        const result = await agent.run(userPrompt);

        // Then - it should return null due to parsing error
        expect(result).toBeNull();
    });

    it('should run without input prompt and use default message', async () => {
        // Given - a basic agent and no input prompt
        server.use(
            http.post('https://openrouter.ai/api/v1/chat/completions', async ({ request }) => {
                const body = (await request.json()) as ChatCompletionRequest;

                // Verify the complete request structure when no input is provided
                expect(body.messages).toHaveLength(2);
                expect(body.messages[0].role).toBe('system');
                expect(body.messages[1].role).toBe('user');
                expect(body.messages[0].content).toBe('You are a helpful AI assistant.');
                expect(body.messages[1].content).toBe('Proceed with your instructions.');
                expect(body.model).toBe(mockModelName);

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

        const agent = new BasicAgentAdapter('NoInputAgent', {
            model,
            systemPrompt,
        });

        // When - running the agent without input
        const result = await agent.run();

        // Then - it should return the response for the default message
        expect(result).toBe('Proceeding with default instructions.');
    });
});
