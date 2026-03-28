---
name: jterrazz-intelligence
description: Composable AI utilities for the @jterrazz ecosystem — structured output parsing, middleware for logging and observability, result handling, and provider helpers. Activates when working with AI generation, parsing AI output, or configuring AI middleware.
---

# @jterrazz/intelligence

Part of the @jterrazz ecosystem. Composable utilities for AI SDK apps.

## Structured generation

High-level API combining text generation + JSON parsing + error classification:

```typescript
import { generateStructured } from "@jterrazz/intelligence";
import { z } from "zod";

const result = await generateStructured({
  model: provider.model("gpt-4o"),
  prompt: "Analyze this company",
  schema: z.object({ name: z.string(), score: z.number() }),
});

if (result.success) {
  console.log(result.data.name);
} else {
  console.log(result.error.code); // TIMEOUT | RATE_LIMITED | PARSING_FAILED | ...
}
```

## Result handling

Discriminated union for explicit error handling:

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
  type GenerationErrorCode,
} from "@jterrazz/intelligence";
```

| Function                                   | Description                    |
| ------------------------------------------ | ------------------------------ |
| `generationSuccess(data)`                  | Create success result          |
| `generationFailure(code, message, cause?)` | Create failure result          |
| `isSuccess(result)`                        | Type guard for success         |
| `isFailure(result)`                        | Type guard for failure         |
| `unwrap(result)`                           | Extract data or throw          |
| `unwrapOr(result, default)`                | Extract data or return default |
| `classifyError(error)`                     | Auto-classify error into code  |

Error codes: `TIMEOUT`, `RATE_LIMITED`, `PARSING_FAILED`, `VALIDATION_FAILED`, `AI_GENERATION_FAILED`, `EMPTY_RESULT`

## Parsing

### parseObject — extract JSON from AI output

```typescript
import { parseObject, ParseObjectError } from "@jterrazz/intelligence";

const data = parseObject(aiText, z.object({ name: z.string() }));
```

Handles: markdown code blocks, embedded JSON in prose, malformed JSON repair, escaped characters, multiple JSON structures (selects largest valid).

### parseText — sanitize AI text

```typescript
import { parseText } from "@jterrazz/intelligence";

const clean = parseText(aiText, {
  collapseSpaces: true,
  normalizeEmDashesToCommas: true,
});
```

Removes: BOM, invisible characters, AI citation markers, control characters. Normalizes: line endings, smart quotes, dashes, spaces, NFKC unicode.

### createSchemaPrompt — generate schema instructions

```typescript
import { createSchemaPrompt } from "@jterrazz/intelligence";

const systemPrompt = createSchemaPrompt(schema);
// Returns XML-wrapped instructions for models without native structured output
```

## Middleware

### Logging middleware

```typescript
import { createLoggingMiddleware } from "@jterrazz/intelligence";

const middleware = createLoggingMiddleware({
  logger,
  include: { params: true, content: true, usage: true },
});
```

Logs: `ai.generate.start`, `ai.generate.complete` (with durationMs, usage), `ai.generate.error`

### Observability middleware

```typescript
import {
  createObservabilityMiddleware,
  withObservability,
  LangfuseAdapter,
} from "@jterrazz/intelligence";

const middleware = createObservabilityMiddleware({
  observability: new LangfuseAdapter({ secretKey, publicKey }),
  providerMetadata: new OpenRouterMetadataAdapter(),
});

// Pass trace metadata via provider options
const result = await generateText({
  model,
  prompt,
  providerOptions: withObservability({ traceId: "abc", name: "analyze" }),
});
```

## Providers

### OpenRouter

```typescript
import { createOpenRouterProvider, OpenRouterMetadataAdapter } from "@jterrazz/intelligence";

const provider = createOpenRouterProvider({
  apiKey: process.env.OPENROUTER_API_KEY,
  metadata: { application: "my-app" },
});

const model = provider.model("anthropic/claude-sonnet-4", {
  reasoning: { effort: "high" },
  maxTokens: 4096,
});
```

### OpenAI-compatible

```typescript
import {
  createOpenAICompatibleProvider,
  OpenAICompatibleMetadataAdapter,
} from "@jterrazz/intelligence";

const provider = createOpenAICompatibleProvider({
  apiKey: process.env.API_KEY,
  baseURL: "https://api.example.com/v1",
});
```

## Ports

| Port                   | Description                                                 |
| ---------------------- | ----------------------------------------------------------- |
| `ObservabilityPort`    | Interface for observability adapters (Langfuse, etc.)       |
| `ProviderMetadataPort` | Interface for extracting usage/cost from provider responses |

Implement these to add custom observability platforms or provider adapters.
