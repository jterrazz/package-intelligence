# @jterrazz/intelligence

A thin composition layer over [AI SDK v7](https://ai-sdk.dev) — provider factories, cost/fallback/logging middleware, and a config-driven factory that wires them together. Observability goes through OpenTelemetry: the host app registers an OTel Node SDK (e.g. via [`@jterrazz/telemetry`](https://www.npmjs.com/package/@jterrazz/telemetry)), and this package emits AI SDK spans and a `gen_ai.usage.cost` attribute into it.

The public surface is AI SDK's own `LanguageModel` type — every factory here returns a model you can pass straight into `generateText`, `streamText`, `generateObject`, etc.

## Installation

```bash
npm install @jterrazz/intelligence ai
```

`ai` (^7.0.0) is a peer dependency — bring your own version.

## Quick start

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
        localProxy: {
            type: 'gateway',
            baseURL: 'https://my-gateway.example.com/v1',
            apiKey: process.env.PROXY_API_KEY,
        },
    },
    agents: {
        summarizer: {
            provider: 'openrouter',
            model: 'google/gemini-2.5-flash-lite',
            fallback: { provider: 'openrouter', model: 'openai/gpt-4o-mini' },
        },
        localAgent: {
            provider: 'localProxy',
            model: 'some-local-model',
        },
    },
    pricing: {
        // USD per million tokens — used only when the provider doesn't report actual cost
        'openrouter/openai/gpt-4o-mini': { input: 0.15, output: 0.6 },
    },
    logger, // LoggerPort from @jterrazz/telemetry, optional
});

const model = intelligence.model('summarizer');
const { text } = await generateText({ model, prompt: 'Summarize this article...' });
```

Each agent has a `provider` (a key into `providers`) and a `model` (the technical model id, passed through to the provider as-is — e.g. `'anthropic/claude-sonnet-4'` for a model id that itself contains a `/`). `pricing` is keyed by `"<provider>/<model>"`, joining those same two fields.

`intelligence.model(agentName)` builds each model lazily and caches it — calling it twice for the same agent returns the same instance.

## What `createIntelligence` wires up

For each resolved model reference:

1. The provider's base model (via `createOpenRouterProvider` or `createGatewayProvider`).
2. `createCostMiddleware` — records the generation's USD cost on the active OpenTelemetry span.
3. If the agent has a `fallback`, `createFallbackModel` wraps primary + fallback with automatic retry-on-failure.
4. If a `logger` is configured, `createLoggingMiddleware` wraps the whole thing.

On first use, `createIntelligence` registers the AI SDK's OpenTelemetry integration (`@ai-sdk/otel`) globally. This is idempotent and best-effort — if the host app hasn't set up an OpenTelemetry SDK, this is a no-op rather than an error.

## Building blocks

Each piece is also exported individually if you want to compose things yourself instead of using `createIntelligence`.

### Providers

```typescript
import { createOpenRouterProvider, createGatewayProvider } from '@jterrazz/intelligence';

const openrouter = createOpenRouterProvider({
    apiKey: process.env.OPENROUTER_API_KEY,
    metadata: { application: 'my-app', website: 'https://example.com' },
});
const model = openrouter.model('anthropic/claude-sonnet-4-20250514');

// Per-call options (reasoning effort, max tokens, ...) now go through providerOptions
// at the call site instead of the provider factory:
await generateText({
    model,
    prompt: 'Hello!',
    providerOptions: { openrouter: { reasoning: { effort: 'high' } } },
});
```

```typescript
const proxy = createGatewayProvider({
    baseURL: 'https://my-gateway.example.com/v1',
    apiKey: process.env.PROXY_API_KEY,
});
const model = proxy.model('some-model-id');
```

`createGatewayProvider` targets the chat completions endpoint (`.chat()`, not the Responses API) for maximum compatibility with gateways exposing any API implementing the OpenAI chat completions spec, and wraps every model with AI SDK's `extractJsonMiddleware` — a safety net that strips markdown code fences from responses. This matters for gateways that sometimes wrap JSON output in ` ```json ` fences even when structured output was requested.

### Cost middleware

```typescript
import { wrapLanguageModel } from 'ai';
import { createCostMiddleware } from '@jterrazz/intelligence';

const model = wrapLanguageModel({
    model: provider.model('google/gemini-2.5-flash-lite'),
    middleware: [
        createCostMiddleware({
            modelRef: 'openrouter/google/gemini-2.5-flash-lite',
            // Only used as a fallback when the provider doesn't report actual cost
            pricing: { input: 0.1, output: 0.4 }, // USD per million tokens
        }),
    ],
});
```

Cost resolution order:

1. Actual cost reported by the provider (currently: OpenRouter's `providerMetadata.openrouter.usage.cost`), when present and greater than zero.
2. Otherwise, an estimate from `pricing` and the reported token usage.

When a cost is determined, it's set as the `gen_ai.usage.cost` attribute on `trace.getActiveSpan()`. This is the attribute Langfuse's OpenTelemetry ingestion prioritizes over its own cost inference — `langfuse.observation.cost_details` is buggy on ingestion, so this package deliberately avoids it. All enrichment is best-effort: it never throws, even with no active span or a broken telemetry backend.

### Fallback model

```typescript
import { createFallbackModel } from '@jterrazz/intelligence';

const model = createFallbackModel({
    primary: provider.model('anthropic/claude-sonnet-4'),
    fallback: provider.model('openai/gpt-4o-mini'),
    logger, // optional — logs 'ai.fallback.triggered' when the switch happens
});
```

`createFallbackModel` returns a model (implementing `LanguageModelV4`), not a middleware — a middleware can't swap the underlying model. It retries on the fallback only for retryable errors: HTTP 429, 5xx, and network errors (connection refused/reset, timeouts). Non-retryable errors (400s, validation errors, aborts) propagate unchanged.

### Logging middleware

```typescript
import { wrapLanguageModel } from 'ai';
import { createLoggingMiddleware } from '@jterrazz/intelligence';

const model = wrapLanguageModel({
    model: provider.model('anthropic/claude-sonnet-4-20250514'),
    middleware: createLoggingMiddleware({
        logger,
        include: {
            params: false, // Log request params
            content: false, // Log response content
            usage: true, // Log token usage (default: true)
        },
    }),
});
```

Logs `ai.generate.start` / `ai.generate.complete` / `ai.generate.error` (and the `ai.stream.*` equivalents) with timing and usage.

### `cleanAiText` / `toSentenceCase` — text formatting utilities

Dependency-free — import them from `@jterrazz/intelligence/formatting` to avoid installing `ai`.

```typescript
import { cleanAiText, toSentenceCase } from '@jterrazz/intelligence/formatting';

const clean = cleanAiText(messyAiOutput);
// Removes: BOM, zero-width chars, citation markers
// Normalizes: smart quotes, em dashes, ellipsis

const headline = toSentenceCase('Your Next AI Skill Is Worldbuilding');
// -> "Your next AI skill is worldbuilding"
```

## Agent & prompt conventions

`@jterrazz/intelligence` gives you the `LanguageModel`; how you organize the agents that call it is up to the host repo, but here's the folder-per-agent convention we've converged on across `@jterrazz` projects:

```
agents/
  article-composer/
    article-composer.ts          # the agent class — canonical, framework-visible
    article-composer.prompt.ts   # the prompt, and only the prompt
  event-assigner/
    event-assigner.ts
    event-assigner.prompt.ts
  _shared/
    category-taxonomy.prompt.ts  # sections shared across agents
```

Large agents can split their prompt across several `<name>-<section>.prompt.ts` files instead of one.

The hard rule: **no multi-line natural-language literal outside `*.prompt.ts`.** The class only shapes data — filter, sort, map to flat records, `JSON.stringify` — and hands the builder plain values, never assembled prose. `generateText`/`Output.object` stay visible in `run()`, unabstracted:

```typescript
export class ArticleComposer implements ArticleComposerPort {
    static readonly SCHEMA = z.object({/* ... */});

    constructor(
        private readonly model: LanguageModel,
        private readonly logger: LoggerPort,
    ) {}

    async run(input: ArticleCompositionInput): Promise<ArticleCompositionResult> {
        const { output } = await generateText({
            model: this.model,
            output: Output.object({ schema: ArticleComposer.SCHEMA }),
            prompt: buildPrompt({
                angle: input.angle,
                factsJson: ArticleComposer.buildFactsJson(input.facts),
                history: ArticleComposer.buildHistoryRecords(input.previousArticles),
            }),
        });
        return output;
    }

    // Data prep only — map/sort/JSON.stringify/flatten to records. No prose.
    private static buildFactsJson(facts: Fact[]): string {
        /* ... */
    }

    private static buildHistoryRecords(articles?: PreviousArticle[]): HistoryArticle[] {
        /* sort chronologically, map to { angle, body, date, headline }[] */
    }
}
```

The sibling `*.prompt.ts` holds all the prose. It's not limited to one `buildPrompt` — it can export several builders, a main one plus section builders it calls internally, each owning its own empty-case handling:

```typescript
// article-composer.prompt.ts
interface HistoryArticle {
    angle: string;
    body: string;
    date: string;
    headline: string;
}

interface Variables {
    angle: string;
    factsJson: string;
    history: HistoryArticle[];
}

export const buildHistorySection = (articles: HistoryArticle[]): string => {
    if (articles.length === 0) {
        return '';
    }

    return `\n\n## Previously Published Articles\n\n${articles
        .map((a) => `### ${a.headline}\n${a.body}`)
        .join('\n\n')}`;
};

export const buildPrompt = (v: Variables): string => {
    return `# Article Composition

Your angle for this article: **${v.angle}**.

## Facts

${v.factsJson}${buildHistorySection(v.history)}`;
};
```

Sections reused across agents (a category taxonomy needed by both an assigner and an ingester, say) live in `_shared/<name>.prompt.ts` as `export const <name> = (): string => { ... }` and get imported wherever they're needed — never copy-pasted between prompt files.

Why: this is the shape most reference TypeScript AI codebases converge on, and it gives the prompt↔variables contract native TypeScript typing instead of loose string interpolation.

### Enforcing it — `@jterrazz/intelligence/oxlint`

These conventions are mechanized as an oxlint plugin, shaped like `@jterrazz/test`'s own `oxlint` export: a `LintPlugin` of `intelligence/*` rules, a manifest of `RULE_DOCS`, and a composable `intelligence` fragment.

```typescript
import { compose, node } from '@jterrazz/typescript/oxlint';
import { intelligence } from '@jterrazz/intelligence/oxlint';

export default compose(node, intelligence);
```

`compose()` (from `@jterrazz/typescript/oxlint`) merges any number of fragments — add `@jterrazz/test`'s `testing` fragment, `hexagonal`, or your own overrides the same way: `compose(node, hexagonal, testing, intelligence, { rules: {...} })`.

| Rule                                            | Severity | Enforces                                                                                                                    |
| ----------------------------------------------- | -------- | --------------------------------------------------------------------------------------------------------------------------- |
| `intelligence/p1-prose-in-prompt-files`         | error    | No multi-line natural-language template literal outside `*.prompt.ts` — the flagship rule for this whole convention.        |
| `intelligence/p2-prompt-file-exports`           | error    | A `*.prompt.ts` file exports only const string-builder functions and types/interfaces.                                      |
| `intelligence/p3-agent-prompt-sibling`          | error    | An agent file imports `./<name>.prompt.js`; a non-`_shared/` prompt file has its `<name>.ts` sibling on disk.               |
| `intelligence/g1-agent-class-shape`             | error    | An agent file exports exactly one class with `static readonly SCHEMA`, a `run` method, and `constructor(model, ...)`.       |
| `intelligence/m1-model-resolution-in-container` | error    | `createIntelligence`/`createGatewayProvider`/`createOpenRouterProvider` and `.model('…')` resolution are DI/container-only. |
| `intelligence/m2w-no-hardcoded-model-id`        | warning  | A string literal shaped like a model id outside config/test/fixture files — model ids belong in configuration.              |

Each rule is deliberately best-effort where full static verification isn't possible (documented per rule via `meta.docs` / the manifest) — the goal is catching the common slip, not a type checker.

## API Reference

### Factory

| Export                       | Description                                                  |
| ---------------------------- | ------------------------------------------------------------ |
| `createIntelligence(config)` | Config-driven factory: agents → fully wired `LanguageModel`s |

### Middleware

| Export                             | Description                                   |
| ---------------------------------- | --------------------------------------------- |
| `createCostMiddleware(options)`    | Records USD cost on the active OTel span      |
| `createLoggingMiddleware(options)` | Logs requests/responses with timing and usage |

### Model

| Export                         | Description                                        |
| ------------------------------ | -------------------------------------------------- |
| `createFallbackModel(options)` | A `LanguageModel` that retries on a fallback model |

### Providers

| Export                             | Description                                              |
| ---------------------------------- | -------------------------------------------------------- |
| `createOpenRouterProvider(config)` | OpenRouter provider for AI SDK                           |
| `createGatewayProvider(config)`    | Provider for any gateway exposing a chat-completions API |

### Formatting

| Export                           | Description                                                                |
| -------------------------------- | -------------------------------------------------------------------------- |
| `cleanAiText(text, options?)`    | Sanitize AI-generated text (also at `/formatting`)                         |
| `toSentenceCase(text, options?)` | Normalize Title Case overuse back to sentence case (also at `/formatting`) |
