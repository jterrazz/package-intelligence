import { afterAll, afterEach, beforeAll, describe, expect, it } from '@jterrazz/test';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { z } from 'zod/v4';

import { ChatAgent } from '../src/adapters/agents/chat-agent.adapter.js';
import { SystemPrompt } from '../src/adapters/prompts/system-prompt.adapter.js';
import { UserPrompt } from '../src/adapters/prompts/user-prompt.adapter.js';
import { OpenRouterProvider } from '../src/adapters/providers/openrouter-provider.adapter.js';

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
    response_format?: {
        json_schema: {
            name: string;
            schema: JsonSchema;
            strict: boolean;
        };
        type: string;
    };
    temperature?: number;
}

interface JsonSchema {
    [key: string]: unknown;
    maxLength?: number;
    minLength?: number;
    properties?: Record<string, unknown>;
    type: string;
}

// Mock server setup
const server = setupServer();

// Test data
const mockApiKey = 'test-api-key';
const mockModelName = 'google/gemini-2.5-flash-preview-05-20';

describe('ChatAgent Integration Tests', () => {
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

                // Verify structured outputs (response_format) is NOT present when no schema is provided
                expect(body.response_format).toBeUndefined();

                return HttpResponse.json({
                    choices: [
                        {
                            index: 0,
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

        const provider = new OpenRouterProvider({
            apiKey: mockApiKey,
        });
        const model = provider.getModel(mockModelName);

        const systemPrompt = new SystemPrompt('You are a helpful AI assistant.');

        const agent = new ChatAgent('TestAgent', {
            model,
            systemPrompt,
        });

        const userPrompt = new UserPrompt('Hello, how are you?');

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

                // NOTE: OpenRouter supports structured outputs via response_format parameter,
                // but the current @openrouter/ai-sdk-provider (v0.7.3) doesn't pass through
                // the responseFormat from Vercel AI SDK to the HTTP request.
                // This means we rely on prompt-based schema instructions only.
                // See: https://openrouter.ai/docs/features/structured-outputs

                // Verify structured outputs (response_format) is NOT present yet due to provider limitation
                expect(body.response_format).toBeUndefined();

                // TODO: Once @openrouter/ai-sdk-provider supports responseFormat parameter,
                // uncomment and use these assertions instead:
                // expect(body.response_format).toBeDefined();
                // if (body.response_format) {
                //     expect(body.response_format.type).toBe('json_schema');
                //     expect(body.response_format.json_schema).toBeDefined();
                //     expect(body.response_format.json_schema.name).toBe('response');
                //     expect(body.response_format.json_schema.strict).toBe(true);
                //     expect(body.response_format.json_schema.schema).toBeDefined();
                //     const schema = body.response_format.json_schema.schema;
                //     expect(schema.type).toBe('object');
                //     expect(schema.properties).toBeDefined();
                //     expect(schema.properties.confidence).toBeDefined();
                //     expect(schema.properties.message).toBeDefined();
                //     expect(schema.properties.metadata).toBeDefined();
                // }

                return HttpResponse.json({
                    choices: [
                        {
                            index: 0,
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

        const provider = new OpenRouterProvider({
            apiKey: mockApiKey,
        });
        const model = provider.getModel(mockModelName);

        const systemPrompt = new SystemPrompt(
            'You are a helpful AI assistant that responds with structured data.',
        );

        const agent = new ChatAgent('SchemaAgent', {
            model,
            schema: responseSchema,
            systemPrompt,
        });

        const userPrompt = new UserPrompt('Generate a structured response.');

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

                // NOTE: OpenRouter supports structured outputs via response_format parameter,
                // but the current @openrouter/ai-sdk-provider (v0.7.3) doesn't pass through
                // the responseFormat from Vercel AI SDK to the HTTP request.
                // This means we rely on prompt-based schema instructions only.

                // Verify structured outputs (response_format) is NOT present yet due to provider limitation
                expect(body.response_format).toBeUndefined();

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

        const agent = new ChatAgent('StringAgent', {
            model,
            schema: stringSchema,
            systemPrompt,
        });

        const userPrompt = new UserPrompt('Give me a simple response.');

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

                // Verify structured outputs (response_format) is NOT present when no schema is provided
                expect(body.response_format).toBeUndefined();

                // Return different responses based on user input
                if (userMessage.includes('weather')) {
                    expect(userMessage).toBe('What is the weather like?');
                    return HttpResponse.json({
                        choices: [
                            {
                                index: 0,
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
                                index: 0,
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
                                index: 0,
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

        const provider = new OpenRouterProvider({
            apiKey: mockApiKey,
        });
        const model = provider.getModel(mockModelName);

        const systemPrompt = new SystemPrompt('You are a helpful AI assistant.');

        const agent = new ChatAgent('ConditionalAgent', {
            model,
            systemPrompt,
        });

        // When - testing weather question
        const weatherPrompt = new UserPrompt('What is the weather like?');
        const weatherResult = await agent.run(weatherPrompt);

        // Then - it should return weather response
        expect(weatherResult).toBe('The weather is sunny today!');

        // When - testing time question
        const timePrompt = new UserPrompt('What time is it?');
        const timeResult = await agent.run(timePrompt);

        // Then - it should return time response
        expect(timeResult).toBe('It is currently 3:00 PM.');

        // When - testing other question
        const otherPrompt = new UserPrompt('Tell me a joke.');
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

                // NOTE: OpenRouter supports structured outputs via response_format parameter,
                // but the current @openrouter/ai-sdk-provider (v0.7.3) doesn't pass through
                // the responseFormat from Vercel AI SDK to the HTTP request.
                // This means we rely on prompt-based schema instructions only.

                // Verify structured outputs (response_format) is NOT present yet due to provider limitation
                expect(body.response_format).toBeUndefined();

                return HttpResponse.json({
                    choices: [
                        {
                            index: 0,
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

        const provider = new OpenRouterProvider({
            apiKey: mockApiKey,
        });
        const model = provider.getModel(mockModelName);

        const systemPrompt = new SystemPrompt('You are a helpful AI assistant.');

        const agent = new ChatAgent('InvalidJsonAgent', {
            model,
            schema: responseSchema,
            systemPrompt,
        });

        const userPrompt = new UserPrompt('Generate invalid response.');

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

                // Verify structured outputs (response_format) is NOT present when no schema is provided
                expect(body.response_format).toBeUndefined();

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

        const agent = new ChatAgent('NoInputAgent', {
            model,
            systemPrompt,
        });

        // When - running the agent without input
        const result = await agent.run();

        // Then - it should return the response for the default message
        expect(result).toBe('Proceeding with default instructions.');
    });
});
