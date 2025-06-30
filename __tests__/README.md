# Integration Tests

This directory contains integration tests for the `@jterrazz/intelligence` package. These tests use MSW (Mock Service Worker) to mock HTTP requests and test the full flow of the agents with real-like API interactions.

## Test Files

### `basic-agent.integration.test.ts`

Tests the `BasicAgentAdapter` functionality including:

- ✅ **Basic query execution** - Tests successful agent execution without schema validation
- ✅ **Complete JSON schema validation** - Tests agent execution with complex object schemas and validates complete system prompt construction
- ✅ **Complete primitive schema validation** - Tests agent execution with primitive schemas and validates formatting instructions
- ✅ **Invalid JSON handling** - Tests graceful handling of unparseable responses with schemas
- ✅ **Default message handling** - Tests agent execution without input prompts
- ✅ **Complete request body validation** - Tests verify the entire HTTP request body content
- ✅ **Conditional responses** - Tests different responses based on request content
- ✅ **System prompt construction** - Validates complete system prompt formatting with schema instructions

### `retryable-agent.integration.test.ts`

Tests the `RetryableAgentAdapter` decorator functionality including:

- ✅ **Successful first attempt** - Tests that retries are not triggered when first attempt succeeds
- ✅ **Retry on parsing failures** - Tests retry logic when response parsing fails
- ✅ **Primitive schema support** - Tests retryable agent with primitive type schemas
- ✅ **No input prompt support** - Tests retryable agent execution without input prompts
- ✅ **Descriptive naming** - Tests that the retryable agent name includes the wrapped agent name

## Comprehensive Request Body Validation

The tests include comprehensive request body inspection to verify that:

### Complete Message Structure Validation
```typescript
// Verify complete message structure
expect(body.messages).toHaveLength(2);
expect(body.messages[0].role).toBe('system');
expect(body.messages[1].role).toBe('user');
expect(body.messages[1].content).toBe('Hello, how are you?');
expect(body.model).toBe(mockModelName);

// Verify exact system prompt content (without schema)
expect(body.messages[0].content).toBe('You are a helpful AI assistant.');
```

### Complete Schema Instruction Validation
```typescript
// Verify complete system prompt with schema instructions
const systemPrompt = body.messages[0].content;

// Check base prompt is included
expect(systemPrompt).toContain('You are a helpful AI assistant that responds with structured data.');

// Check schema formatting instructions
expect(systemPrompt).toContain('<OUTPUT_FORMAT>');
expect(systemPrompt).toContain('You must respond with valid JSON that matches this exact schema:');
expect(systemPrompt).toContain('Your response must be parseable JSON that validates against this schema.');
expect(systemPrompt).toContain('Do not include any text outside the JSON.');
expect(systemPrompt).toContain('</OUTPUT_FORMAT>');

// Check the actual JSON schema is included
expect(systemPrompt).toContain('"message"');
expect(systemPrompt).toContain('"confidence"');
expect(systemPrompt).toContain('"metadata"');
expect(systemPrompt).toContain('"type": "object"');
expect(systemPrompt).toContain('"type": "string"');
expect(systemPrompt).toContain('"type": "number"');
expect(systemPrompt).toContain('"type": "array"');
```

### Primitive Schema Instruction Validation
```typescript
// Verify primitive schema instructions
expect(systemPrompt).toContain('You must respond with a string value that matches this schema:');
expect(systemPrompt).toContain('Your response should be only the string value');
expect(systemPrompt).toContain('without any JSON wrapping or additional text');
expect(systemPrompt).toContain('"type": "string"');
expect(systemPrompt).toContain('"minLength": 5');
expect(systemPrompt).toContain('"maxLength": 100');
```

### Conditional Responses Based on Complete Body Analysis
```typescript
// Return different responses based on exact user input
const userMessage = body.messages[1].content;
if (userMessage.includes('weather')) {
    expect(userMessage).toBe('What is the weather like?'); // Exact match validation
    return HttpResponse.json({ /* weather response */ });
} else if (userMessage.includes('time')) {
    expect(userMessage).toBe('What time is it?'); // Exact match validation
    return HttpResponse.json({ /* time response */ });
}
```

### Default Message Validation
```typescript
// Verify complete request structure when no input is provided
expect(body.messages).toHaveLength(2);
expect(body.messages[0].role).toBe('system');
expect(body.messages[1].role).toBe('user');
expect(body.messages[0].content).toBe('You are a helpful AI assistant.');
expect(body.messages[1].content).toBe('Proceed with your instructions.');
expect(body.model).toBe(mockModelName);
```

## Test Setup

### Dependencies

- `@jterrazz/test` - Provides Vitest testing framework and utilities
- `msw` - Mock Service Worker for HTTP request mocking
- `zod` - Schema validation library

### Type Safety

Request bodies are properly typed with TypeScript interfaces:

```typescript
interface ChatCompletionMessage {
    role: 'system' | 'user' | 'assistant';
    content: string;
}

interface ChatCompletionRequest {
    messages: ChatCompletionMessage[];
    model: string;
    max_tokens?: number;
    temperature?: number;
    [key: string]: unknown;
}
```

### Mock Configuration

All tests use a shared MSW server setup that:

- Mocks the OpenRouter API endpoint (`https://openrouter.ai/api/v1/chat/completions`)
- Performs comprehensive request body inspection and validation
- Validates complete system prompt construction including schema instructions
- Provides realistic API responses for different test scenarios
- Automatically resets between tests to ensure isolation

### Running Tests

```bash
# Run all integration tests
npm test -- __tests__ --run

# Run specific test file
npm test -- __tests__/basic-agent.integration.test.ts --run
npm test -- __tests__/retryable-agent.integration.test.ts --run
```

## Test Structure

All tests follow the **Given/When/Then** structure with comprehensive body validation:

```typescript
it('should describe what the test does', async () => {
    // Given - setup with complete request body validation
    server.use(
        http.post('https://openrouter.ai/api/v1/chat/completions', async ({ request }) => {
            const body = (await request.json()) as ChatCompletionRequest;
            
            // Verify complete request structure
            expect(body.messages).toHaveLength(2);
            expect(body.messages[0].role).toBe('system');
            expect(body.messages[1].role).toBe('user');
            expect(body.model).toBe(mockModelName);
            
            // Verify complete system prompt content
            const systemPrompt = body.messages[0].content;
            expect(systemPrompt).toContain('Expected base prompt');
            expect(systemPrompt).toContain('Expected schema instructions');
            
            // Verify exact user message
            expect(body.messages[1].content).toBe('Expected user message');
            
            return HttpResponse.json({ /* response */ });
        })
    );
    const agent = new BasicAgentAdapter(/* configuration */);

    // When - execute the action being tested
    const result = await agent.run(input);

    // Then - assert the expected outcome
    expect(result).toBe(expectedValue);
});
```

This comprehensive validation ensures that:
- The complete request structure is correct
- System prompts are properly constructed with schema instructions
- User messages are correctly transmitted
- Schema formatting instructions are properly injected
- Model configuration is correct
- Both the request and response are validated for complete end-to-end testing 