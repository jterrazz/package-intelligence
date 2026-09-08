# Architecture

A thin composition layer over [AI SDK v7](https://ai-sdk.dev): provider
factories, cost/fallback/logging middleware, a config-driven factory that
wires them together, and an oxlint plugin that mechanizes the agent/prompt
convention the package assumes of its consumers. The public surface is AI
SDK's own `LanguageModel` type — every factory returns a model a consumer
passes straight into `generateText`, `streamText`, `generateObject`.

## The building blocks

```
src/
  factory/create-intelligence.ts   the composition root — config in, LanguageModel out
  provider/                        openrouter, gateway               → 05-providers.md
  middleware/                      agent, cost, logging, schema-instruction → 06-middleware.md
  model/fallback-model.ts          the one non-middleware model wrapper
  formatting.ts, formatting/       dependency-free text utilities, its own entry point
  lint/                            the intelligence/* oxlint plugin
  index.ts                         the default entry — everything but formatting
```

Three entry points, one package: `.` (the factory, providers, middleware,
model), `./formatting` (dependency-free — no `ai` or `@ai-sdk/*` import, so a
consumer can normalize text without installing the AI SDK), and `./oxlint`
(the lint plugin, equally free of the `ai` runtime graph). `tsdown.config.ts`
builds each as its own ESM+CJS pair; the three subpaths are the `exports`
map of `package.json`, and there is no fourth.

## What `createIntelligence` wires

For each resolved model reference (`factory/create-intelligence.ts`):

1. The provider's base model, via `createOpenRouterProvider` or
   `createGatewayProvider`.
2. `createAgentMiddleware` — names the AI SDK's inference span after the
   agent (`gen_ai.agent.name`), so a trace backend reading only that span
   (Langfuse) still knows which agent generated.
3. `createCostMiddleware` — records the generation's USD cost on the same
   span.
4. If the agent config has a `fallback`, `createFallbackModel` wraps primary
   and fallback with automatic retry-on-failure.
5. If a `logger` is configured, `createLoggingMiddleware` wraps the whole
   thing.

`createIntelligence` also registers the AI SDK's OpenTelemetry integration
(`@ai-sdk/otel`) globally, once per process (`ensureTelemetryRegistered`) —
idempotent and best-effort: a host with no OTel SDK configured drops the
spans rather than throwing. `intelligence.model(agentName)` builds each
model lazily and caches it by agent name, so a second call returns the same
instance.

## The model layer

`createFallbackModel` (`src/model/fallback-model.ts`) returns a
`LanguageModelV4`, not a middleware — a middleware cannot swap the
underlying model, only transform one model's behaviour. It retries on the
fallback only for a RETRYABLE error: an `APICallError` with status `429` or
`>= 500`, or a network-shaped message (`ECONNREFUSED`, `ETIMEDOUT`, `fetch
failed`, and siblings). A non-retryable error (400s, validation, an abort)
propagates unchanged, and the switch is logged as `ai.fallback.triggered`
when a logger is configured.

## The lint plugin — the agent/prompt convention

`src/lint/` mechanizes the shape a consumer's own agent code is expected to
hold, as a `LintPlugin` of `intelligence/*` rules composed the same way
`@jterrazz/typescript`'s own presets are:

```typescript
import { compose, node } from '@jterrazz/typescript/oxlint';
import { intelligence } from '@jterrazz/intelligence/oxlint';

export default compose(node, intelligence);
```

`compose()` (from `@jterrazz/typescript/oxlint`) merges any number of
fragments the same way — `@jterrazz/test`'s `testing` fragment, `hexagonal`,
or a project's own overrides:
`compose(node, hexagonal, testing, intelligence, { rules: {...} })`.

The shape it enforces, folder-per-agent with the prompt isolated from the
class that shapes data for it:

```
agents/<name>/<name>.ts          the agent class — SCHEMA, constructor(model, ...), run()
agents/<name>/<name>.prompt.ts   the prompt, and only the prompt
agents/_shared/<name>.prompt.ts  sections shared across agents
```

The hard rule: **no multi-line natural-language literal outside
`*.prompt.ts`.** The class only shapes data — filter, sort, map to flat
records, `JSON.stringify` — and hands `buildPrompt` plain values, never
assembled prose; `generateText`/`Output.object` stay visible in `run()`,
unabstracted. A `*.prompt.ts` file is not limited to one export: a main
`buildPrompt` plus section builders it calls internally, each a pure
`(data) => string` function owning its own empty-case handling.

| Rule                                            | Severity | Enforces                                                                                                          |
| ----------------------------------------------- | -------- | ----------------------------------------------------------------------------------------------------------------- |
| `intelligence/p1-prose-in-prompt-files`         | error    | No multi-line natural-language template literal outside `*.prompt.ts` — the flagship rule.                        |
| `intelligence/p2-prompt-file-exports`           | error    | A `*.prompt.ts` file exports only const string-builder functions and types/interfaces.                            |
| `intelligence/p3-agent-prompt-sibling`          | error    | An agent file imports `./<name>.prompt.js`; a non-`_shared/` prompt file has its `<name>.ts` sibling on disk.     |
| `intelligence/g1-agent-class-shape`             | error    | An agent file exports exactly one class with `static readonly SCHEMA`, a `run` method, `constructor(model, ...)`. |
| `intelligence/m1-model-resolution-in-container` | error    | `createIntelligence`/`createGatewayProvider`/`createOpenRouterProvider` and `.model('…')` are DI/container-only.  |
| `intelligence/m2w-no-hardcoded-model-id`        | warning  | A string literal shaped like a model id outside config/test/fixture files.                                        |

Each rule is deliberately best-effort where full static verification is not
possible — the goal is catching the common slip, not standing in for a type
checker. `src/lint/manifest.ts` carries each rule's `RULE_DOCS` entry,
`src/lint/plugin.ts` composes them into the `intelligence` fragment plus a
`recommendedRules` map, and `src/lint/agents.ts` / `src/lint/ast.ts` /
`src/lint/fs.ts` hold the AST and filesystem helpers every rule shares. How
a new rule is added, and what a change to this convention owes, is
[02-developing.md](02-developing.md); how it is proven is
[03-testing.md](03-testing.md).

## Formatting

`src/formatting.ts` is the dependency-free entry: `cleanAiText` (BOM,
invisible characters, AI citation markers, control characters removed;
line endings, smart quotes, dashes, spaces and NFKC unicode normalized) and
`toSentenceCase` (Title Case overuse folded back to sentence case,
preserving acronyms and genuine proper nouns). `toSentenceCase` lazy-loads
hunspell dictionaries from disk, which is why a Next.js consumer adds
`serverExternalPackages: ['@jterrazz/intelligence']` to `next.config.ts` —
bundling that `require.resolve`/`readFileSync` pair breaks it.

## The exports map

| Export                                                                                                          | From                                              |
| --------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| `createIntelligence`, `Intelligence`, `IntelligenceConfig`, `AgentConfig`, `ProviderConfig`                     | `.`                                               |
| `createAgentMiddleware`, `createCostMiddleware`, `createLoggingMiddleware`, `createSchemaInstructionMiddleware` | `.`                                               |
| `createFallbackModel`, `FallbackModelOptions`                                                                   | `.`                                               |
| `createOpenRouterProvider`, `createGatewayProvider`                                                             | `.`                                               |
| `cleanAiText`, `toSentenceCase`                                                                                 | `./formatting` only — `.` does not re-export them |
| `intelligence` fragment, `recommendedRules`, the plugin default export                                          | `./oxlint`                                        |

`ai` (`>=7.0.0`) is a peer dependency, optional at the type level
(`peerDependenciesMeta.ai.optional`) so a consumer that only needs
`./formatting` installs nothing else.
