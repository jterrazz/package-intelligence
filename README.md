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
    },
    agents: {
        summarizer: {
            provider: 'openrouter',
            model: 'google/gemini-2.5-flash-lite',
            fallback: { provider: 'openrouter', model: 'openai/gpt-4o-mini' },
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

Each agent has a `provider` (a key into `providers`) and a `model` (the technical model id, passed through to the provider as-is). `pricing` is keyed by `"<provider>/<model>"`. `intelligence.model(agentName)` builds each model lazily and caches it — calling it twice for the same agent returns the same instance.

## Documentation

The full corpus lives in [`docs/`](docs/):

- [Architecture](docs/01-architecture.md) — the building blocks, what `createIntelligence` wires, the lint plugin's agent/prompt convention, the exports map.
- [Developing](docs/02-developing.md) — the toolchain, where a new provider/middleware/rule goes.
- [Testing](docs/03-testing.md) — the unit, integration and lint-plugin suites.
- [Operating](docs/04-operating.md) — what publishes this package, and what a merge to `main` does not.
- [Providers](docs/05-providers.md) — OpenRouter and gateway.
- [Middleware](docs/06-middleware.md) — agent, cost, logging, schema-instruction.

Decisions this package alone took are in [`docs/decisions/`](docs/decisions/), numbered in the order they were taken.

For agents: a Claude Code skill, [`skills/jterrazz-intelligence`](skills/jterrazz-intelligence/SKILL.md), routes into this corpus.
