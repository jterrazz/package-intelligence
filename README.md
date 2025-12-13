# @jterrazz/intelligence

Lightweight utilities for AI SDK apps — structured output parsing, text sanitization, and provider helpers.

## Installation

```bash
npm install @jterrazz/intelligence ai zod
```

## Parsing Utilities

### `parseObject` — Extract structured data from AI responses

Extracts and validates JSON from messy AI outputs (markdown blocks, embedded JSON, malformed syntax).

```typescript
import { parseObject } from '@jterrazz/intelligence';
import { z } from 'zod';

const schema = z.object({
    title: z.string(),
    tags: z.array(z.string()),
});

// Handles markdown code blocks, embedded JSON, trailing commas, etc.
const text = '```json\n{"title": "Hello", "tags": ["ai", "typescript"]}\n```';
const result = parseObject(text, schema);
// → { title: 'Hello', tags: ['ai', 'typescript'] }
```

### `createSchemaPrompt` — Generate schema instructions for prompts

Creates system prompt instructions for models that don't support native structured outputs.

```typescript
import { generateText } from 'ai';
import { createSchemaPrompt, parseObject } from '@jterrazz/intelligence';
import { z } from 'zod';

const schema = z.object({ summary: z.string(), score: z.number() });

const { text } = await generateText({
    model,
    prompt: 'Analyze this article...',
    system: createSchemaPrompt(schema), // Injects JSON schema instructions
});

const result = parseObject(text, schema);
```

### `parseText` — Sanitize AI-generated text

Removes invisible characters, normalizes typography, and cleans common AI artifacts.

```typescript
import { parseText } from '@jterrazz/intelligence';

const clean = parseText(messyAiOutput);
// Removes: BOM, zero-width chars, AI citation markers
// Normalizes: smart quotes → straight, em dashes → ", ", ellipsis → ...
// Collapses multiple spaces and trims

// Options
parseText(text, {
    normalizeEmDashesToCommas: true, // Convert em/en dashes to ", " (default: true)
    collapseSpaces: true, // Collapse multiple spaces, trim (default: true)
});
```

## Provider

### `createOpenRouterProvider` — OpenRouter for AI SDK

```typescript
import { generateText } from 'ai';
import { createOpenRouterProvider } from '@jterrazz/intelligence';

const provider = createOpenRouterProvider({
    apiKey: process.env.OPENROUTER_API_KEY,
});

const { text } = await generateText({
    model: provider.model('anthropic/claude-sonnet-4-20250514'),
    prompt: 'Hello!',
});
```

With reasoning models:

```typescript
const model = provider.model('anthropic/claude-sonnet-4-20250514', {
    maxTokens: 16000,
    reasoning: { effort: 'high' },
});
```

## Middleware

### `createLoggingMiddleware` — Log AI SDK requests

```typescript
import { wrapLanguageModel } from 'ai';
import { createLoggingMiddleware } from '@jterrazz/intelligence';

const model = wrapLanguageModel({
    model: provider.model('anthropic/claude-sonnet-4-20250514'),
    middleware: createLoggingMiddleware({
        logger, // Any logger with debug/error methods
        include: {
            params: false, // Include request params (default: false)
            content: false, // Include response content (default: false)
            usage: true, // Include token usage (default: true)
        },
    }),
});
```

Happy coding! 🚀
