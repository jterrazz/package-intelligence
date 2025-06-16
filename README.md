# Package Intelligence

A TypeScript-based AI agent framework built with clean architecture principles, providing composable prompt libraries, structured chat agents, and tool integration for intelligent automation.

## Features

- 🤖 **Structured Chat Agents** - LangChain-powered agents with optional responses
- 📚 **Composable Prompt Library** - Modular prompt parts for consistent AI behavior
- 🛠️ **Safe Tool Integration** - Error-handled tool execution with logging
- 🎯 **Type-Safe Responses** - Zod-validated AI response parsing
- 💪 **100% TypeScript** - Full type safety throughout
- 🏗️ **Clean Architecture** - Ports and adapters pattern for extensibility

## Installation

```bash
npm install package-intelligence
```

## Quick Start

### Basic Chat Agent

```typescript
import { ChatAgentAdapter } from 'package-intelligence/agents';
import { OpenRouterAdapter } from 'package-intelligence/models';
import { PROMPTS } from 'package-intelligence/prompts';

// Create a model
const model = new OpenRouterAdapter({
  apiKey: process.env.OPENROUTER_API_KEY!,
  modelName: 'anthropic/claude-3.5-sonnet',
});

// Create an agent with a preset
const agent = new ChatAgentAdapter('discord-bot', PROMPTS.PRESETS.DISCORD_COMMUNITY_ANIMATOR, {
  model,
  tools: [],
});

// Run the agent
const response = await agent.run();
console.log(response);
```

### Custom Prompt Composition

```typescript
import { SystemPromptAdapter, UserPromptAdapter } from 'package-intelligence/prompts';
import { PROMPTS } from 'package-intelligence/prompts';

// Create custom system prompt
const systemPrompt = new SystemPromptAdapter([
  PROMPTS.DIRECTIVES.BE_SAFE,
  PROMPTS.PERSONA.EXPERT_ADVISOR,
  PROMPTS.DOMAIN.SOFTWARE_ENGINEERING,
  PROMPTS.TONE.PROFESSIONAL,
  PROMPTS.LANGUAGE.ENGLISH_NATIVE,
]);

// Create user prompt
const userPrompt = new UserPromptAdapter(['Please review this TypeScript code for best practices']);

const agent = new ChatAgentAdapter('code-reviewer', systemPrompt.generate(), { model, tools: [] });

const response = await agent.run(userPrompt);
```

### Tool Integration

```typescript
import { SafeToolAdapter } from 'package-intelligence/tools';
import { z } from 'zod/v4';

// Create a tool with schema validation
const weatherTool = new SafeToolAdapter(
  {
    name: 'get_weather',
    description: 'Get current weather for a location',
    execute: async (args) => {
      const response = await fetch(`/api/weather?city=${args.city}`);
      return response.json();
    },
  },
  {
    schema: z.object({
      city: z.string().describe('City name'),
    }),
  },
);

// Use tool with agent
const agent = new ChatAgentAdapter('weather-bot', PROMPTS.PRESETS.EMPATHETIC_SUPPORT_AGENT, {
  model,
  tools: [weatherTool.getDynamicTool()],
});
```

## Prompt Library

The composable prompt library provides building blocks for consistent AI behavior:

### Categories

- **`DIRECTIVES`** - Core safety and ethical rules
- **`PERSONA`** - Agent character (Expert Advisor, Creative Partner, etc.)
- **`DOMAIN`** - Area of expertise (Software Engineering, Business Strategy, etc.)
- **`TONE`** - Communication style (Professional, Empathetic, Humorous, etc.)
- **`LANGUAGE`** - Natural language and proficiency level
- **`VERBOSITY`** - Level of detail (Concise, Normal, Detailed)
- **`FORMAT`** - Output structure (Markdown, JSON, Step-by-step, etc.)
- **`AGENT_LOGIC`** - Response behavior (Always Respond, Tool First, etc.)
- **`AGENT_SKILLS`** - Primary capabilities (Problem Solving, Creative Ideation, etc.)

### Presets

Ready-to-use combinations for common scenarios:

```typescript
// Available presets
PROMPTS.PRESETS.DISCORD_COMMUNITY_ANIMATOR; // Fun community engagement
PROMPTS.PRESETS.EMPATHETIC_SUPPORT_AGENT; // User support
PROMPTS.PRESETS.CREATIVE_BRAINSTORMER; // Ideation and creativity
```

## Architecture

This package follows hexagonal architecture principles:

```
src/
├── ports/                 # Core interfaces
│   ├── agent.port.ts     # Agent interface
│   ├── model.port.ts     # Model provider interface
│   ├── tool.port.ts      # Tool interface
│   └── prompt.port.ts    # Prompt interface
├── adapters/
│   ├── agents/           # Agent implementations
│   ├── models/           # Model provider implementations
│   ├── tools/            # Tool implementations
│   ├── prompts/          # Prompt implementations
│   │   └── library/      # Composable prompt parts
│   └── utils/            # Utilities (parsers, etc.)
└── index.ts              # Main exports
```

## Core Components

### ChatAgentAdapter

Structured chat agent with optional responses:

```typescript
const agent = new ChatAgentAdapter(
    name: string,                    // Agent identifier
    systemPrompts: readonly string[], // System prompt parts
    options: ChatAgentOptions        // Model, tools, logger
);
```

### AIResponseParser

Type-safe response parsing with Zod schemas:

```typescript
const parser = new AIResponseParser(schema);
const result = parser.parse(aiResponse);
```

### SafeToolAdapter

Error-handled tool execution:

```typescript
const tool = new SafeToolAdapter(config, options);
const dynamicTool = tool.getDynamicTool();
```

## Examples

### Discord Community Bot

```typescript
const discordBot = new ChatAgentAdapter(
  'discord-community-bot',
  PROMPTS.PRESETS.DISCORD_COMMUNITY_ANIMATOR,
  { model, tools: [] },
);

// Bot will engage with fun, community-focused responses
const response = await discordBot.run(
  new UserPromptAdapter(["What's happening in the tech world today?"]),
);
```

### Code Review Assistant

```typescript
const codeReviewer = new ChatAgentAdapter(
  'code-reviewer',
  [
    PROMPTS.DIRECTIVES.BE_FACTUAL,
    PROMPTS.PERSONA.EXPERT_ADVISOR,
    PROMPTS.DOMAIN.SOFTWARE_ENGINEERING,
    PROMPTS.TONE.PROFESSIONAL,
    PROMPTS.VERBOSITY.DETAILED,
    PROMPTS.FORMAT.MARKDOWN,
  ],
  { model, tools: [codeAnalysisTool] },
);
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is open source and available under the [MIT License](LICENSE).

## Author

- Jean-Baptiste Terrazzoni ([@jterrazz](https://github.com/jterrazz))
- Email: contact@jterrazz.com
