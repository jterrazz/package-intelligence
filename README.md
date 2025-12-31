# @jterrazz/intelligence

Lightweight, composable utilities for AI SDK apps - middleware for logging and observability, structured output parsing, result handling, and provider helpers.

## Installation

```bash
npm install @jterrazz/intelligence ai zod
```

## Generation

### `generateStructured` - Type-safe structured generation with error handling

Combines `generateText` + `parseObject` + error classification into a single function that returns a discriminated union result.

```typescript
import { generateStructured, withObservability } from "@jterrazz/intelligence";
import { z } from "zod";

const schema = z.object({
  sentiment: z.string(),
  score: z.number(),
});

const result = await generateStructured({
  model,
  prompt: "Analyze this article...",
  schema,
  providerOptions: withObservability({ traceId: "trace-123" }),
});

if (result.success) {
  console.log(result.data.sentiment, result.data.score);
} else {
  // Typed error with code: TIMEOUT | RATE_LIMITED | PARSING_FAILED | etc.
  console.error(result.error.code, result.error.message);
}
```

## Result Utilities

Discriminated union result type for explicit error handling.

```typescript
import {
  generationSuccess,
  generationFailure,
  isSuccess,
  isFailure,
  unwrap,
  unwrapOr,
  classifyError,
  type GenerationResult,
} from "@jterrazz/intelligence";

// Create results
const success = generationSuccess({ data: "value" });
const failure = generationFailure("TIMEOUT", "Request timed out");

// Type guards
if (isSuccess(result)) {
  console.log(result.data);
}

// Unwrap with default
const value = unwrapOr(result, defaultValue);

// Classify errors automatically
try {
  await someOperation();
} catch (error) {
  const code = classifyError(error); // TIMEOUT, RATE_LIMITED, PARSING_FAILED, etc.
}
```

## Middleware

Composable middlewares that wrap AI SDK models. Stack them together for logging, observability, and more.

### Composing Middlewares

```typescript
import { wrapLanguageModel } from "ai";
import {
  createLoggingMiddleware,
  createObservabilityMiddleware,
  LangfuseAdapter,
  OpenRouterMetadataAdapter,
} from "@jterrazz/intelligence";

const model = wrapLanguageModel({
  model: provider.model("anthropic/claude-sonnet-4-20250514"),
  middleware: [
    createLoggingMiddleware({ logger, include: { usage: true } }),
    createObservabilityMiddleware({
      observability: new LangfuseAdapter({
        secretKey: process.env.LANGFUSE_SECRET_KEY,
        publicKey: process.env.LANGFUSE_PUBLIC_KEY,
      }),
      providerMetadata: new OpenRouterMetadataAdapter(),
    }),
  ],
});
```

### Logging Middleware

Logs AI SDK requests with timing, usage, and optional content.

```typescript
import { wrapLanguageModel, generateText } from "ai";
import { createLoggingMiddleware } from "@jterrazz/intelligence";

const model = wrapLanguageModel({
  model: provider.model("anthropic/claude-sonnet-4-20250514"),
  middleware: createLoggingMiddleware({
    logger,
    include: {
      params: false,  // Log request params
      content: false, // Log response content
      usage: true,    // Log token usage (default: true)
    },
  }),
});

await generateText({ model, prompt: "Hello!" });
// Logs: ai.generate.start, ai.generate.complete (with durationMs, usage, etc.)
```

### Observability Middleware

Sends generation data to observability platforms (Langfuse, etc.).

```typescript
import { wrapLanguageModel, generateText } from "ai";
import {
  createObservabilityMiddleware,
  withObservability,
  LangfuseAdapter,
} from "@jterrazz/intelligence";

const observability = new LangfuseAdapter({
  secretKey: process.env.LANGFUSE_SECRET_KEY,
  publicKey: process.env.LANGFUSE_PUBLIC_KEY,
});

const model = wrapLanguageModel({
  model: provider.model("anthropic/claude-sonnet-4-20250514"),
  middleware: createObservabilityMiddleware({ observability }),
});

// Use withObservability() helper for type-safe metadata
await generateText({
  model,
  prompt: "Analyze this...",
  providerOptions: withObservability({
    traceId: "trace-123",
    name: "analyzer",
    metadata: { userId: "user-1" },
  }),
});
```

### Custom Adapters

Implement ports to integrate with any platform:

```typescript
import type { ObservabilityPort, ProviderMetadataPort } from "@jterrazz/intelligence";

// Observability adapter (Datadog, etc.)
class DatadogAdapter implements ObservabilityPort {
  trace(params) { /* ... */ }
  generation(params) { /* ... */ }
  async flush() { /* ... */ }
  async shutdown() { /* ... */ }
}

// Provider metadata adapter (extract usage/cost)
class AnthropicMetadataAdapter implements ProviderMetadataPort {
  extract(metadata) {
    return { usage: { ... }, cost: { ... } };
  }
}
```

## Parsing Utilities

### `parseObject` - Extract structured data from AI responses

Extracts and validates JSON from messy AI outputs (markdown blocks, malformed syntax).

````typescript
import { parseObject } from "@jterrazz/intelligence";
import { z } from "zod";

const schema = z.object({
  title: z.string(),
  tags: z.array(z.string()),
});

const text = '```json\n{"title": "Hello", "tags": ["ai"]}\n```';
const result = parseObject(text, schema);
// { title: "Hello", tags: ["ai"] }
````

### `createSchemaPrompt` - Generate schema instructions

Creates system prompt instructions for models without native structured output.

```typescript
import { generateText } from "ai";
import { createSchemaPrompt, parseObject } from "@jterrazz/intelligence";
import { z } from "zod";

const schema = z.object({ summary: z.string(), score: z.number() });

const { text } = await generateText({
  model,
  prompt: "Analyze this article...",
  system: createSchemaPrompt(schema),
});

const result = parseObject(text, schema);
```

### `parseText` - Sanitize AI-generated text

Removes invisible characters, normalizes typography, cleans AI artifacts.

```typescript
import { parseText } from "@jterrazz/intelligence";

const clean = parseText(messyAiOutput);
// Removes: BOM, zero-width chars, citation markers
// Normalizes: smart quotes, em dashes, ellipsis
```

## Provider

### `createOpenRouterProvider` - OpenRouter for AI SDK

```typescript
import { generateText } from "ai";
import { createOpenRouterProvider } from "@jterrazz/intelligence";

const provider = createOpenRouterProvider({
  apiKey: process.env.OPENROUTER_API_KEY,
});

const { text } = await generateText({
  model: provider.model("anthropic/claude-sonnet-4-20250514"),
  prompt: "Hello!",
});

// With reasoning models
const reasoningModel = provider.model("anthropic/claude-sonnet-4-20250514", {
  maxTokens: 16000,
  reasoning: { effort: "high" },
});
```

## API Reference

### Generation

| Export                        | Description                                            |
| ----------------------------- | ------------------------------------------------------ |
| `generateStructured(options)` | Generate and parse structured data with error handling |

### Result

| Export                                     | Description                                              |
| ------------------------------------------ | -------------------------------------------------------- |
| `GenerationResult<T>`                      | Discriminated union result type                          |
| `generationSuccess(data)`                  | Create success result                                    |
| `generationFailure(code, message, cause?)` | Create failure result                                    |
| `isSuccess(result)`                        | Type guard for success                                   |
| `isFailure(result)`                        | Type guard for failure                                   |
| `unwrap(result)`                           | Extract data or throw                                    |
| `unwrapOr(result, default)`                | Extract data or return default                           |
| `classifyError(error)`                     | Classify error into error code                           |
| `GenerationErrorCode`                      | Error codes: TIMEOUT, RATE_LIMITED, PARSING_FAILED, etc. |

### Middleware

| Export                                   | Description                                  |
| ---------------------------------------- | -------------------------------------------- |
| `createLoggingMiddleware(options)`       | Creates logging middleware                   |
| `createObservabilityMiddleware(options)` | Creates observability middleware             |
| `withObservability(meta)`                | Helper for type-safe observability metadata  |
| `LangfuseAdapter`                        | Langfuse implementation of ObservabilityPort |
| `NoopObservabilityAdapter`               | No-op adapter for testing/development        |
| `OpenRouterMetadataAdapter`              | Extract usage/cost from OpenRouter           |

### Ports

| Export                 | Description                                |
| ---------------------- | ------------------------------------------ |
| `ObservabilityPort`    | Interface for observability adapters       |
| `ProviderMetadataPort` | Interface for provider metadata extraction |

### Parsing

| Export                       | Description                              |
| ---------------------------- | ---------------------------------------- |
| `parseObject(text, schema)`  | Parse and validate JSON from AI output   |
| `createSchemaPrompt(schema)` | Generate schema instructions for prompts |
| `parseText(text, options?)`  | Sanitize AI-generated text               |

### Provider

| Export                             | Description                           |
| ---------------------------------- | ------------------------------------- |
| `createOpenRouterProvider(config)` | Create OpenRouter provider for AI SDK |
