# @jterrazz/intelligence

**A composable, type-safe, and framework-agnostic AI agent library for TypeScript.**

[![NPM Version](https://img.shields.io/npm/v/@jterrazz/intelligence.svg)](https://www.npmjs.com/package/@jterrazz/intelligence)
[![License](https://img.shields.io/npm/l/@jterrazz/intelligence.svg)](./LICENSE)

`@jterrazz/intelligence` provides a clean, structured, and extensible foundation for building sophisticated AI agents. By combining a composable prompt system, safe tool integration, and a ports-and-adapters architecture, it empowers developers to create reliable and maintainable AI-powered applications.

---

## Why Use This Library?

- **🤖 Build Predictable Agents**: Use the composable prompt library to ensure your agents have a consistent personality, tone, and behavior.
- **🛠️ Integrate Tools Safely**: `SafeToolAdapter` provides built-in error handling, logging, and Zod-based schema validation for all your tools.
- **🏗️ Stay Flexible**: The ports-and-adapters architecture makes it easy to swap out underlying models or frameworks (like LangChain) without rewriting your core logic.
- **🎯 Get Type-Safe Responses**: Move beyond string parsing with `AIResponseParser`, which validates and types your model's output against a Zod schema.

## Installation

```bash
npm install @jterrazz/intelligence
```

---

## Quick Start

Get your first agent running in under a minute. This example uses a preset to create a helpful Discord community animator.

```typescript
import {
  ChatAgentAdapter,
  OpenRouterModelAdapter,
  SystemPromptAdapter,
  PROMPTS,
} from '@jterrazz/intelligence';

// 1. Set up the model provider
const model = new OpenRouterModelAdapter({
  apiKey: process.env.OPENROUTER_API_KEY!, // Make sure to set this environment variable
  modelName: 'anthropic/claude-3.5-sonnet',
});

// 2. Create an agent using a preset prompt
const agent = new ChatAgentAdapter('discord-bot', {
  model,
  systemPrompt: new SystemPromptAdapter(PROMPTS.PRESETS.DISCORD_COMMUNITY_ANIMATOR),
});

// 3. Run the agent
const response = await agent.run();

console.log(response);
// Output might be: "Hello, community! I'm here to help with any questions and keep the good vibes flowing. What's on your mind today?"
```

---

## Core Concepts

### 1. Composable Prompts

Instead of writing monolithic prompts, the library provides a collection of composable string constants. Mix and match them to build a precise, fine-grained system prompt that defines your agent's behavior.

- **`PERSONA`**: Who the agent is (e.g., `EXPERT_ADVISOR`).
- **`TONE`**: How the agent communicates (e.g., `PROFESSIONAL`, `EMPATHETIC`).
- **`FORMAT`** How the agent structures its response (e.g., `MARKDOWN`, `JSON`).
- **`DIRECTIVES`**: Core rules the agent must follow (e.g., `BE_SAFE`, `BE_FACTUAL`).

This approach makes agent behavior more predictable and easier to modify.

### 2. Safe Tool Integration

The `SafeToolAdapter` is a wrapper for your functions that ensures they are executed safely.

```typescript
import { SafeToolAdapter } from '@jterrazz/intelligence';
import { z } from 'zod/v4';

const weatherTool = new SafeToolAdapter(
  {
    name: 'get_weather',
    description: 'Get the current weather for a specific city.',
    execute: async ({ city }) => `The weather in ${city} is currently sunny.`,
  },
  {
    // Zod schema for automatic validation and type-safety
    schema: z.object({
      city: z.string().describe('The city name'),
    }),
  },
);
```

The adapter handles errors gracefully and integrates seamlessly with the agent, which will automatically provide the Zod schema to the underlying model.

### 3. Ports and Adapters Architecture

The library is built on a hexagonal architecture.

- **Ports (`/ports`)**: Define the contracts (interfaces) for core components like `Agent`, `Model`, and `Tool`.
- **Adapters (`/adapters`)**: Provide concrete implementations. For example, `ChatAgentAdapter` is an adapter that uses LangChain, and `OpenRouterModelAdapter` is an adapter for the OpenRouter API.

This separation of concerns means you can easily create your own adapters to support different models or services without changing the application's core logic.

```
src/
├── ports/      # Abstract interfaces (the "what")
└── adapters/   # Concrete implementations (the "how")
```

---

## Recipes

### Recipe: Code Review Assistant

This recipe creates an agent that acts as an expert software engineer, providing detailed feedback on code.

```typescript
import {
  ChatAgentAdapter,
  OpenRouterModelAdapter,
  SystemPromptAdapter,
  UserPromptAdapter,
  PROMPTS,
} from '@jterrazz/intelligence';

const model = new OpenRouterModelAdapter({
  apiKey: process.env.OPENROUTER_API_KEY!,
  modelName: 'anthropic/claude-3.5-sonnet',
});

// 1. Compose the system prompt from multiple parts (using rest arguments)
const systemPrompt = new SystemPromptAdapter(
  PROMPTS.PERSONA.EXPERT_ADVISOR,
  PROMPTS.DOMAIN.SOFTWARE_ENGINEERING,
  PROMPTS.TONE.PROFESSIONAL,
  PROMPTS.VERBOSITY.DETAILED,
  PROMPTS.FORMAT.MARKDOWN,
  PROMPTS.DIRECTIVES.BE_FACTUAL,
);

// 2. Create the user request (using a single array)
const userPrompt = new UserPromptAdapter([
  'Please review this TypeScript code for best practices:',
  'const x = (s) => s.trim();',
]);

// 3. Configure and run the agent
const agent = new ChatAgentAdapter('code-reviewer', {
  model,
  systemPrompt,
});

const response = await agent.run(userPrompt);

console.log(response);
```

### Recipe: Simple Text Processor (QueryAgent)

This example shows how to use the simpler `QueryAgentAdapter` for one-shot responses without tools.

```typescript
import {
  QueryAgentAdapter,
  OpenRouterModelAdapter,
  SystemPromptAdapter,
  UserPromptAdapter,
  PROMPTS,
} from '@jterrazz/intelligence';

const model = new OpenRouterModelAdapter({
  apiKey: process.env.OPENROUTER_API_KEY!,
  modelName: 'anthropic/claude-3.5-sonnet',
});

// 1. Create a simple system prompt for text processing
const systemPrompt = new SystemPromptAdapter(
  PROMPTS.PERSONA.EXPERT_ADVISOR,
  PROMPTS.TONE.PROFESSIONAL,
  PROMPTS.FORMAT.MARKDOWN,
  'You are a helpful assistant that improves text clarity and grammar.',
);

// 2. Create a query agent (no tools needed)
const agent = new QueryAgentAdapter('text-processor', {
  model,
  systemPrompt,
});

// 3. Run a simple query
const userPrompt = new UserPromptAdapter(
  'Please improve this text: "Me and john was going to store yesterday"',
);
const response = await agent.run(userPrompt);

console.log(response);
// Expected output: A grammatically corrected and improved version of the text
```

### Recipe: Structured Data Extraction (QueryAgent with Schema)

This example shows how to use `QueryAgentAdapter` with schema parsing for structured responses.

  ```typescript
import {
  QueryAgentAdapter,
  OpenRouterModelAdapter,
  SystemPromptAdapter,
  UserPromptAdapter,
  PROMPTS,
} from '@jterrazz/intelligence';
import { z } from 'zod/v4';

const model = new OpenRouterModelAdapter({
  apiKey: process.env.OPENROUTER_API_KEY!,
  modelName: 'anthropic/claude-3.5-sonnet',
});

// 1. Define the response schema
const extractionSchema = z.object({
  name: z.string(),
  email: z.string().email(),
  phone: z.string().optional(),
  company: z.string().optional(),
});

// 2. Create a system prompt for data extraction
const systemPrompt = new SystemPromptAdapter(
  PROMPTS.PERSONA.EXPERT_ADVISOR,
  PROMPTS.TONE.PROFESSIONAL,
  PROMPTS.FORMAT.JSON,
  'You extract contact information from text and return it as JSON.',
);

// 3. Create a query agent with schema parsing
const agent = new QueryAgentAdapter('contact-extractor', {
  model,
  schema: extractionSchema,
  systemPrompt,
});

// 4. Run the query
const userPrompt = new UserPromptAdapter(
  'Extract contact info: "Hi, I\'m John Doe from TechCorp. Email me at john@techcorp.com or call 555-1234"',
);
const response = await agent.run(userPrompt);

// 5. Get both raw response and parsed data
console.log('Raw response:', response);
const parsedData = agent.getLastParsedResult();
console.log('Parsed data:', parsedData);
// Expected: { name: "John Doe", email: "john@techcorp.com", phone: "555-1234", company: "TechCorp" }
```

### Recipe: Weather Bot with Tools

This example shows how to give an agent a tool and have it respond to a user query.

  ```typescript
import {
  ChatAgentAdapter,
  OpenRouterModelAdapter,
  SafeToolAdapter,
  SystemPromptAdapter,
  PROMPTS,
} from '@jterrazz/intelligence';
import { z } from 'zod/v4';

// Assume 'model' is already configured

// 1. Define the tool
const weatherTool = new SafeToolAdapter(
  {
    name: 'get_weather',
    description: 'Get the current weather for a location.',
    execute: async ({ city }) => {
      // In a real app, you would fetch from a weather API here
      return `The weather in ${city} is 75°F and sunny.`;
    },
  },
  { schema: z.object({ city: z.string().describe('City name') }) },
);

// 2. Create an agent that knows how to use tools
const agent = new ChatAgentAdapter('weather-bot', {
  model,
  systemPrompt: new SystemPromptAdapter(PROMPTS.PRESETS.EMPATHETIC_SUPPORT_AGENT), // A good general-purpose preset
  tools: [weatherTool], // Pass the tool instance directly
});

// 3. Run the agent with a user query that requires the tool
const response = await agent.run({ generate: () => "What's the weather like in Boston?" });

console.log(response);
// Expected output: "The weather in Boston is 75°F and sunny."
```

---

## API Reference

### Core Components

| Class                    | Description                                                                |
| ------------------------ | -------------------------------------------------------------------------- |
| `ChatAgentAdapter`       | The main agent implementation. Runs prompts and coordinates tools.         |
| `QueryAgentAdapter`      | A simpler agent for one-shot responses without tools or complex logic.     |
| `OpenRouterModelAdapter` | An adapter for connecting to any model on the OpenRouter platform.         |
| `SafeToolAdapter`        | A type-safe wrapper for creating tools with validation and error handling. |
| `SystemPromptAdapter`    | A simple adapter to generate a system prompt string from a prompt array.   |
| `UserPromptAdapter`      | A simple adapter to generate a user prompt string from a prompt array.     |
| `AIResponseParser`       | A utility to parse a model's string output into a typed object using Zod.  |
| `PROMPTS`                | A frozen object containing the entire composable prompt library.           |

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## Author

- Jean-Baptiste Terrazzoni ([@jterrazz](https://github.com/jterrazz))
- Email: contact@jterrazz.com
