# @jterrazz/intelligence

**A composable, type-safe, and framework-agnostic AI agent library for TypeScript.**

[![NPM Version](https://img.shields.io/npm/v/@jterrazz/intelligence.svg)](https://www.npmjs.com/package/@jterrazz/intelligence)
[![License](https://img.shields.io/npm/l/@jterrazz/intelligence.svg)](./LICENSE)

`@jterrazz/intelligence` provides a clean, structured, and extensible foundation for building sophisticated AI agents. Built on the **Vercel AI SDK** with **OpenRouter** support, it's designed to help you create reliable and maintainable AI-powered applications by focusing on composability, type safety, and resilience.

---

## Core Principles

- **Composable Prompts**: Instead of monolithic prompts, the library offers a collection of constants. Mix and match them to build a precise system prompt that defines your agent's behavior, personality, and output format.

- **Safe, Typed Tools**: A `SafeTool` provides built-in error handling and Zod-based schema validation for any tool you create. This ensures that tool inputs are valid and that your agent can gracefully handle execution errors.

- **Ports & Adapters Architecture**: The library uses a hexagonal architecture to separate core logic from implementation details. This makes it easy to swap out underlying models or services (e.g., switching from OpenAI to Anthropic) without rewriting your application.

- **Structured Outputs**: Leverages both prompt-based schema instructions and OpenRouter's official structured outputs for reliable, validated responses.

## Installation

```bash
npm install @jterrazz/intelligence
```

---

## Agent Types

### 🗣️ **ChatAgent**

For conversational AI and text generation with optional schema validation. Perfect for chatbots, content generation, and structured data extraction.

### 🛡️ **ResilientAgent**

A decorator that adds retry logic to any agent for fault-tolerant execution. Wraps other agents to handle transient failures gracefully.

### 🔧 **ToolAgent**

For complex workflows requiring external tools and function calling. Can reason about when to use tools and provide structured responses.

---

## Quick Start

Get your first agent running in minutes. This example creates a helpful conversational agent.

```typescript
import { ChatAgent, OpenRouterProvider, SystemPrompt, PROMPTS } from '@jterrazz/intelligence';

// 1. Set up the model provider
const provider = new OpenRouterProvider({
  apiKey: process.env.OPENROUTER_API_KEY!, // Make sure to set this environment variable
});

// 2. Get a model instance
const model = provider.getModel('anthropic/claude-3-5-sonnet-20241022');

// 3. Create a conversational agent
const agent = new ChatAgent('helpful-assistant', {
  model,
  systemPrompt: new SystemPrompt(PROMPTS.PRESETS.HELPFUL_ASSISTANT),
});

// 4. Run the agent
const response = await agent.run();

console.log(response);
// Output: "Hello! I'm here to help you with any questions or tasks you might have. What can I assist you with today?"
```

## Creating Domain-Specific Agents

The most powerful feature of `@jterrazz/intelligence` is its ability to create specialized, reusable agents. By extending the base adapters, you can encapsulate an agent's logic, prompts, and tools into a clean, type-safe class.

### 1. Data Extraction Agent (`ChatAgent`)

Use `ChatAgent` for structured data extraction and conversational tasks. This example creates a reusable agent to extract contact information with full type safety.

```typescript
import {
  ChatAgent,
  OpenRouterProvider,
  SystemPrompt,
  UserPrompt,
  PROMPTS,
} from '@jterrazz/intelligence';
import { z } from 'zod';

// 1. Define the output schema for both compile-time and runtime validation
const contactSchema = z.object({
  name: z.string().describe('The full name of the person'),
  email: z.string().email().describe('The email address'),
  phone: z.string().optional().describe('Phone number if available'),
});

type Contact = z.infer<typeof contactSchema>;

// 2. Create a specialized agent by extending ChatAgent
class ContactExtractorAgent extends ChatAgent<Contact> {
  constructor(provider: OpenRouterProvider) {
    const model = provider.getModel('anthropic/claude-3-5-sonnet-20241022');

    super('contact-extractor', {
      model,
      schema: contactSchema, // Enables structured outputs + runtime validation
      systemPrompt: new SystemPrompt(
        'You are an expert at extracting contact details from text.',
        'Always extract the most complete information available.',
      ),
    });
  }
}

// 3. Instantiate and use the agent
const provider = new OpenRouterProvider({
  apiKey: process.env.OPENROUTER_API_KEY!,
});
const agent = new ContactExtractorAgent(provider);

const text =
  'Say hi to John Doe, you can reach him at john.doe@example.com or call (555) 123-4567.';
const contact = await agent.run(new UserPrompt(text));

console.log(contact);
// Output: { name: 'John Doe', email: 'john.doe@example.com', phone: '(555) 123-4567' }
```

### 2. Tool-Enabled Agent (`ToolAgent`)

Use `ToolAgent` when you need an agent that can reason and use tools to accomplish complex tasks. This example creates a weather assistant.

```typescript
import {
  ToolAgent,
  OpenRouterProvider,
  SafeTool,
  SystemPrompt,
  UserPrompt,
} from '@jterrazz/intelligence';
import { z } from 'zod';

// 1. Define the agent's final output schema
const weatherReportSchema = z.object({
  city: z.string(),
  temperature: z.number(),
  conditions: z.string(),
  forecast: z.string(),
});

type WeatherReport = z.infer<typeof weatherReportSchema>;

// 2. Create a weather tool
const weatherTool = new SafeTool({
  name: 'get_weather',
  description: 'Gets the current weather for a specified city.',
  schema: z.object({
    city: z.string().describe('The name of the city'),
  }),
  execute: async ({ city }) => {
    // In a real app, you would call a weather API here
    if (city.toLowerCase() === 'paris') {
      return JSON.stringify({
        city: 'Paris',
        temperature: 25,
        conditions: 'sunny',
        forecast: 'clear skies for the next 24 hours',
      });
    }
    return `Sorry, I don't have weather information for ${city}.`;
  },
});

// 3. Create a specialized tool agent
class WeatherAssistantAgent extends ToolAgent<WeatherReport> {
  constructor(provider: OpenRouterProvider) {
    const model = provider.getModel('anthropic/claude-3-5-sonnet-20241022');

    super('weather-assistant', {
      model,
      tools: [weatherTool],
      schema: weatherReportSchema, // Structured output for the final response
      systemPrompt: new SystemPrompt(
        'You are a helpful weather assistant.',
        'Use the available tools to get weather information, then provide a complete weather report.',
      ),
    });
  }
}

// 4. Instantiate and use the agent
const provider = new OpenRouterProvider({
  apiKey: process.env.OPENROUTER_API_KEY!,
});
const agent = new WeatherAssistantAgent(provider);

const response = await agent.run(new UserPrompt("What's the weather like in Paris?"));

console.log(response);
// Output: { city: 'Paris', temperature: 25, conditions: 'sunny', forecast: 'clear skies for the next 24 hours' }
```

### 3. Resilient Agent (`ResilientAgent`)

Use `ResilientAgent` to add retry logic and fault tolerance to any existing agent. Perfect for production environments where reliability is crucial.

```typescript
import {
  ChatAgent,
  ResilientAgent,
  OpenRouterProvider,
  SystemPrompt,
  UserPrompt,
} from '@jterrazz/intelligence';
import { z } from 'zod';

// 1. Create a base agent
const provider = new OpenRouterProvider({
  apiKey: process.env.OPENROUTER_API_KEY!,
});

const model = provider.getModel('anthropic/claude-3-5-sonnet-20241022');

const baseAgent = new ChatAgent('sentiment-analyzer', {
  model,
  schema: z.object({
    sentiment: z.enum(['positive', 'negative', 'neutral']),
    confidence: z.number().min(0).max(1),
  }),
  systemPrompt: new SystemPrompt(
    'You are a sentiment analysis expert.',
    'Analyze the sentiment of the given text and provide your confidence level.',
  ),
});

// 2. Wrap with resilient behavior
const resilientAgent = new ResilientAgent(baseAgent, {
  retries: 3, // Will retry up to 3 times on failure
});

// 3. Use the resilient agent - it will automatically retry on failures
const result = await resilientAgent.run(new UserPrompt('I absolutely love this new feature!'));

console.log(result);
// Output: { sentiment: 'positive', confidence: 0.95 }
console.log(resilientAgent.name);
// Output: "Resilient(sentiment-analyzer)"
```

## Advanced Configuration

### Model Configuration

Customize model behavior with detailed configuration options:

```typescript
const provider = new OpenRouterProvider({
  apiKey: process.env.OPENROUTER_API_KEY!,
  metadata: {
    application: 'My AI App',
    website: 'https://myapp.com',
  },
});

// Configure model-specific settings
const model = provider.getModel('anthropic/claude-sonnet-4', {
  maxTokens: 100000,
  reasoning: {
    effort: 'high', // Use high reasoning effort for complex tasks
    exclude: true, // Exclude reasoning from the response
  },
});
```

### Combining Agents

Create powerful workflows by combining different agent types:

```typescript
// Create a pipeline: Chat Agent → Tool Agent → Resilient wrapper
const extractor = new ChatAgent('data-extractor', {
  /* ... */
});
const processor = new ToolAgent('data-processor', {
  /* ... */
});
const resilientProcessor = new ResilientAgent(processor, { retries: 3 });

// Use them in sequence
const rawData = await extractor.run(userInput);
const processedData = await resilientProcessor.run(rawData);
```

## Development

- **Linting**: `npm run lint`
- **Testing**: `npm run test`
- **Building**: `npm run build`

## Architecture

The library follows **Clean Architecture** principles:

- **Ports**: Define interfaces for models, agents, tools, and prompts
- **Adapters**: Implement the ports for specific providers (OpenRouter, tools, etc.)
- **Domain Logic**: Core agent behavior independent of external dependencies

This makes the library:

- **Testable**: Easy to mock dependencies and test business logic
- **Extensible**: Simple to add new model providers or agent types
- **Maintainable**: Clear separation between domain logic and infrastructure

## Contributing

Contributions are welcome! Please feel free to open an issue or submit a pull request.

---

## License

This project is licensed under the [MIT License](./LICENSE).
