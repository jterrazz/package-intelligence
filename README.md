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

## Creating Domain-Specific Agents

The most powerful feature of `@jterrazz/intelligence` is its ability to create specialized, reusable agents. By extending the base adapters, you can encapsulate an agent's logic, prompts, and tools into a clean, type-safe class.

### 1. Data Extraction Agent (`BasicAgentAdapter`)

Use `BasicAgentAdapter` for simpler, one-shot tasks where you need a structured response but don't require complex tool use. This example creates a reusable agent to extract contact information.

```typescript
import {
  BasicAgentAdapter,
  ModelPort,
  OpenRouterAdapter,
  SystemPromptAdapter,
  UserPromptAdapter,
  PROMPT_LIBRARY,
} from '@jterrazz/intelligence';
import { z } from 'zod';

// 1. Define the output type for compile-time type-safety
interface Contact {
  name: string;
  email: string;
}

// 2. Create a specialized agent by extending BasicAgentAdapter
class ContactExtractorAgent extends BasicAgentAdapter<Contact> {
  constructor(model: ModelPort) {
    super('contact-extractor', {
      model,
      // Define the schema for runtime validation and type inference
      schema: z.object({
        name: z.string().describe('The full name of the person'),
        email: z.string().email().describe('The email address'),
      }),
      // Compose the system prompt from the library
      systemPrompt: new SystemPromptAdapter(
        PROMPT_LIBRARY.FORMATS.JSON,
        'You are an expert at extracting contact details from text.',
      ),
    });
  }
}

// 3. Instantiate and use the agent
const model = new OpenRouterAdapter({
  apiKey: process.env.OPENROUTER_API_KEY!,
  modelName: 'anthropic/claude-3.5-sonnet',
});
const agent = new ContactExtractorAgent(model);

const text = 'Say hi to John Doe, you can reach him at john.doe@example.com.';
const contact = await agent.run(new UserPromptAdapter(text));

console.log(contact);
// Output: { name: 'John Doe', email: 'john.doe@example.com' }
```

### 2. Autonomous Agent with a Custom Tool (`AutonomousAgentAdapter`)

Use `AutonomousAgentAdapter` when you need an agent that can reason and use tools to accomplish a task. This example creates a weather assistant that uses a tool and returns a structured JSON response.

```typescript
import {
  AutonomousAgentAdapter,
  ModelPort,
  OpenRouterAdapter,
  SafeToolAdapter,
  SystemPromptAdapter,
  UserPromptAdapter,
} from '@jterrazz/intelligence';
import { z } from 'zod';

// 1. Define the agent's final output type
interface WeatherReport {
  city: string;
  temperature: number;
  conditions: string;
  forecast: string;
}

// 2. Define a tool. Its `execute` function should return a string,
// as the agent will process this output to formulate a final answer.
const weatherTool = new SafeToolAdapter({
  name: 'get_weather',
  description: 'Gets the current weather for a specified city.',
  schema: z.object({ city: z.string().describe('The name of the city') }),
  execute: async ({ city }) => {
    // In a real app, you would call a weather API here.
    // The tool returns raw data, often as a JSON string.
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

// 3. Create a specialized agent that uses the tool and has a structured output
class WeatherAssistantAgent extends AutonomousAgentAdapter<WeatherReport> {
  constructor(model: ModelPort) {
    super('weather-assistant', {
      model,
      tools: [weatherTool],
      // This schema defines the agent's FINAL output structure
      schema: z.object({
        city: z.string(),
        temperature: z.number(),
        conditions: z.string(),
        forecast: z.string(),
      }),
      systemPrompt: new SystemPromptAdapter(
        'You are a helpful weather assistant.',
        'You must use the provided tools to get weather information and then respond with a structured JSON object.',
      ),
    });
  }
}

// 4. Instantiate and use the agent
const model = new OpenRouterAdapter({
  apiKey: process.env.OPENROUTER_API_KEY!,
  modelName: 'anthropic/claude-3.5-sonnet',
});
const agent = new WeatherAssistantAgent(model);

const response = await agent.run(new UserPromptAdapter("What's the weather like in Paris?"));

console.log(response);
// Output: { city: 'Paris', temperature: 25, conditions: 'sunny', forecast: 'clear skies for the next 24 hours' }
```

## Development

- **Linting**: `npm run lint`
- **Testing**: `npm run test`

## Contributing

Contributions are welcome! Please feel free to open an issue or submit a pull request.

---

## License

This project is licensed under the [MIT License](./LICENSE).
