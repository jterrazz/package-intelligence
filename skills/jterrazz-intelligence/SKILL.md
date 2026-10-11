---
name: jterrazz-intelligence
description: Thin composition layer over AI SDK v7 — provider factories, cost/fallback/logging middleware, and a config-driven factory. Observability goes through OpenTelemetry. Activates when configuring AI model access, cost tracking, fallback models, or AI SDK middleware.
---

# @jterrazz/intelligence

Part of the @jterrazz ecosystem. A thin composition layer over AI SDK v7 — the public surface is AI SDK's own model type, `LanguageModelV4`. Observability goes through OpenTelemetry (the host app registers an OTel Node SDK, e.g. via `@jterrazz/telemetry`).

## Quick start — `createIntelligence`

```typescript
import { createIntelligence } from '@jterrazz/intelligence';
import { generateText } from 'ai';

const intelligence = createIntelligence({
    providers: {
        openrouter: {
            type: 'openrouter',
            apiKey: process.env.OPENROUTER_API_KEY,
            metadata: { application: 'my-app', website: 'https://example.com' },
        },
    },

    agents: {
        summarizer: {
            provider: 'openrouter',
            model: 'google/gemini-2.5-flash-lite',
            fallback: { provider: 'openrouter', model: 'openai/gpt-4o-mini' },
        },
    },

    pricing: {
        'openrouter/openai/gpt-4o-mini': { input: 0.15, output: 0.6 }, // USD/1M tokens
    },
    logger, // LoggerPort from @jterrazz/telemetry, optional
});

const model = intelligence.model('summarizer');
const { text } = await generateText({ model, prompt: 'Summarize this article...' });
```

Each agent has a `provider` (key into `providers`) and a `model` (technical model id, passed through as-is). `pricing` is keyed by `"<provider>/<model>"`. Models are built lazily and cached per agent name. Registers `@ai-sdk/otel` telemetry globally on first use, once per process.

## Providers

```typescript
import { createOpenRouterProvider, createGatewayProvider } from '@jterrazz/intelligence';

const openrouter = createOpenRouterProvider({ apiKey: process.env.OPENROUTER_API_KEY });
const model = openrouter.model('anthropic/claude-sonnet-4-20250514');

// Reasoning/max-tokens are call-site providerOptions now, not provider-factory options:
await generateText({
    model,
    prompt: 'Hello!',
    providerOptions: { openrouter: { reasoning: { effort: 'high' } } },
});
```

```typescript
const proxy = createGatewayProvider({ baseURL: 'https://proxy.example.com/v1' });
const model = proxy.model('some-model-id');
```

`createGatewayProvider` targets `.chat()` (chat completions), not the Responses API, and every model is wrapped with the schema-instruction middleware — the JSON schema restated in the last user message, for a gateway that drops `response_format` — and `extractJsonMiddleware`, which strips the markdown fence a gateway may wrap JSON in.

## Middleware

### Cost middleware

```typescript
import { wrapLanguageModel } from 'ai';
import { createCostMiddleware } from '@jterrazz/intelligence';

const model = wrapLanguageModel({
    model: provider.model('google/gemini-2.5-flash-lite'),
    middleware: [
        createCostMiddleware({ pricing: { input: 0.1, output: 0.4 } }), // USD/1M tokens, fallback only
    ],
});
```

Resolution order: (1) actual provider cost (`providerMetadata.openrouter.usage.cost`) when > 0, else (2) `pricing` × token usage. Sets `gen_ai.usage.cost` on the inference span (the attribute Langfuse's OTel ingestion prioritizes); a stream is costed on its `finish` part.

### Logging middleware

```typescript
import { createLoggingMiddleware } from '@jterrazz/intelligence';

const middleware = createLoggingMiddleware({
    logger,
    include: { params: true, content: true, usage: true },
});
```

Logs: `ai.generate.start`, `ai.generate.complete` (durationMs, usage), `ai.generate.error`, plus `ai.stream.*` equivalents.

## Fallback model

```typescript
import { createFallbackModel } from '@jterrazz/intelligence';

const model = createFallbackModel({
    primary: provider.model('anthropic/claude-sonnet-4'),
    fallback: provider.model('openai/gpt-4o-mini'),
    logger, // logs 'ai.fallback.triggered' when it switches
});
```

A model (not middleware — middleware can't swap the underlying model). It switches only on an error the AI SDK marks retryable; which errors those are, and that an abort or a timeout is not one, is `docs/reference/middleware.md` § Fallback's.

## Agent & prompt conventions

Folder-per-agent, prompt isolated from prep logic:

```text
agents/<name>/<name>.ts          # class: SCHEMA, constructor(model, logger), run()
agents/<name>/<name>.prompt.ts   # prompt only: Variables + buildPrompt(v) [+ section builders]
agents/_<subject>/<name>.prompt.ts  # sections shared across agents, in a folder marked for their subject (_taxonomy/)
```

Large agents may split their prompt across several `<name>-<section>.prompt.ts` files instead of one.

Hard rule: **no multi-line natural-language literal outside `*.prompt.ts`.** `run()` calls `generateText({ model, output: Output.object({ schema }), prompt: buildPrompt({...}) })` directly — no execution abstraction, the framework stays visible. The class does data shaping only — map/sort/filter/`JSON.stringify` down to flat records/values — and hands `buildPrompt` plain data, never assembled prose. `*.prompt.ts` holds all the prose and isn't limited to one export: a main `buildPrompt` plus section builders it calls internally (e.g. `buildHistorySection(articles: HistoryArticle[]): string`, returning `''` when `articles` is empty), each a pure `(data) => string` function.

Rationale: the shape reference TypeScript AI codebases converge on, and it gives the prompt↔variables contract native typing. Enforced by `@jterrazz/intelligence/oxlint`:

```typescript
// jterrazz.config.ts
import { intelligence } from '@jterrazz/intelligence/config';
import { defineConfig } from '@jterrazz/typescript/config';

export default defineConfig({ kind: 'api', platform: 'node', presets: [intelligence()] });
```

The preset hands `@jterrazz/typescript` the plugin `@jterrazz/intelligence/oxlint` and every rule at `error` — the toolchain has no warn tier.

Six rules, in three families: `prose-in-prompt-files` (the flagship — no multi-line prose outside `*.prompt.ts`) and `prompt-file-exports` (prompt files export only string-builder consts + types); `agent-prompt-sibling` (the agent↔prompt import/sibling link) and `agent-class-shape` (`static readonly SCHEMA` + `run` + `constructor(model, ...)`); `model-resolution-in-composition` (the package's `createIntelligence`/provider factories and `.model('…')` are composition-root-only, under `composition/`) and `no-hardcoded-model-id` (model ids belong in config). Each finding's `read` is its section of `docs/reference/lint-rules.md`.

## Formatting

### cleanAiText / toSentenceCase — text formatting utilities

```typescript
import { cleanAiText, toSentenceCase } from '@jterrazz/intelligence/formatting';

const clean = cleanAiText(aiText, { collapseSpaces: true, normalizeEmDashesToCommas: true });
const headline = toSentenceCase('Your Next AI Skill Is Worldbuilding');
// -> "Your next AI skill is worldbuilding"
```

`cleanAiText` removes: BOM, invisible characters, AI citation markers, control characters. Normalizes: line endings, smart quotes, dashes, spaces, NFKC unicode.

`toSentenceCase` normalizes Title Case overuse (a common AI/marketing tic) back to sentence case, preserving acronyms and mixed-case proper nouns.
