# @jterrazz/intelligence

**A composable, type-safe, and framework-agnostic AI agent library for TypeScript.**

[![NPM Version](https://img.shields.io/npm/v/@jterrazz/intelligence.svg)](https://www.npmjs.com/package/@jterrazz/intelligence)
[![License](https://img.shields.io/npm/l/@jterrazz/intelligence.svg)](./LICENSE)

`@jterrazz/intelligence` provides a clean, structured, and extensible foundation for building sophisticated AI agents. It's designed to help you create reliable and maintainable AI-powered applications by focusing on composability and type safety.

---

## Core Principles

- **Composable Prompts**: Instead of monolithic prompts, the library offers a collection of constants. Mix and match them to build a precise system prompt that defines your agent's behavior, personality, and output format.

- **Safe, Typed Tools**: A `SafeToolAdapter` provides built-in error handling and Zod-based schema validation for any tool you create. This ensures that tool inputs are valid and that your agent can gracefully handle execution errors.

- **Ports & Adapters Architecture**: The library uses a hexagonal architecture to separate core logic from implementation details. This makes it easy to swap out underlying models or services (e.g., switching from OpenAI to Anthropic) without rewriting your application.

## Installation

```bash
npm install @jterrazz/intelligence
```

---

## Quick Start

Get your first agent running in minutes. This example creates a helpful agent for a Discord community.

```typescript
import {
  AutonomousAgentAdapter,
  OpenRouterAdapter,
  SystemPromptAdapter,
  PROMPT_LIBRARY,
} from '@jterrazz/intelligence';

// 1. Set up the model provider
const model = new OpenRouterAdapter({
  apiKey: process.env.OPENROUTER_API_KEY!, // Make sure to set this environment variable
  modelName: 'anthropic/claude-3.5-sonnet',
});

// 2. Create an agent using a preset prompt
const agent = new AutonomousAgentAdapter('discord-bot', {
  model,
  systemPrompt: new SystemPromptAdapter(PROMPT_LIBRARY.PRESETS.COMMUNITY_ANIMATOR),
});

// 3. Run the agent
const response = await agent.run();

console.log(response);
// Output might be: "Hello, community! I'm here to help with any questions and keep the good vibes flowing. What's on your mind today?"
```

## Usage Examples

### 1. Basic Agent for Structured Data Extraction

Use `BasicAgentAdapter` for simpler, one-shot tasks where you need a structured response but don't require complex tool use. This example extracts contact information from a string into a typed object.

```typescript
import {
  BasicAgentAdapter,
  OpenRouterAdapter,
  SystemPromptAdapter,
  UserPromptAdapter,
  PROMPT_LIBRARY,
} from '@jterrazz/intelligence';
import { z } from 'zod';

const model = new OpenRouterAdapter({
  apiKey: process.env.OPENROUTER_API_KEY!,
  modelName: 'anthropic/claude-3.5-sonnet',
});

// 1. Define the schema for the structured response
const contactSchema = z.object({
  name: z.string().describe('The full name of the person'),
  email: z.string().email().describe('The email address'),
});

// 2. Create an agent with the schema
const agent = new BasicAgentAdapter('contact-extractor', {
  model,
  schema: contactSchema,
  systemPrompt: new SystemPromptAdapter(
    PROMPT_LIBRARY.FORMATS.JSON,
    'You are an expert at extracting contact details from text.',
  ),
});

// 3. Run the agent and get the parsed result
const text = 'Say hi to John Doe, you can reach him at john.doe@example.com.';
await agent.run(new UserPromptAdapter(text));
const contact = agent.getLastParsedResult();

console.log(contact);
// Output: { name: 'John Doe', email: 'john.doe@example.com' }
```

### 2. Autonomous Agent with a Custom Tool

Use `AutonomousAgentAdapter` when you need an agent that can reason and use tools to accomplish a task. This example creates a simple weather tool and an agent that can use it.

```typescript
import {
  AutonomousAgentAdapter,
  OpenRouterAdapter,
  SafeToolAdapter,
  SystemPromptAdapter,
  UserPromptAdapter,
  PROMPT_LIBRARY,
} from '@jterrazz/intelligence';
import { z } from 'zod';

const model = new OpenRouterAdapter({
  apiKey: process.env.OPENROUTER_API_KEY!,
  modelName: 'anthropic/claude-3.5-sonnet',
});

// 1. Define a tool with input validation
const weatherTool = new SafeToolAdapter({
  name: 'get_weather',
  description: 'Gets the current weather for a specified city.',
  schema: z.object({
    city: z.string().describe('The name of the city'),
  }),
  execute: async ({ city }) => {
    // In a real app, you would call a weather API here
    if (city.toLowerCase() === 'paris') {
      return 'The weather in Paris is sunny and 25°C.';
    }
    return `Sorry, I don't have weather information for ${city}.`;
  },
});

// 2. Create an agent and provide it with the tool
const agent = new AutonomousAgentAdapter('weather-assistant', {
  model,
  tools: [weatherTool],
  systemPrompt: new SystemPromptAdapter('You are a helpful weather assistant.'),
});

// 3. Run the agent
const response = await agent.run(new UserPromptAdapter("What's the weather like in Paris?"));

console.log(response);
// Output: "The weather in Paris is sunny and 25°C."
```

## Development

- **Linting**: `npm run lint`
- **Testing**: `npm run test`

## Contributing

Contributions are welcome! Please feel free to open an issue or submit a pull request.

---

## License

This project is licensed under the [MIT License](./LICENSE).
