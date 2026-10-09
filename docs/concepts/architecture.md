# Architecture

A thin composition layer over [AI SDK v7](https://ai-sdk.dev): provider factories, cost, fallback and logging middleware, a config-driven factory that wires them together, and a preset that holds a consumer's agent code to the convention the package assumes. Every factory returns an AI SDK `LanguageModelV4`, which a consumer passes straight into `generateText` or `streamText`.

## The building blocks

```text
src/
  factory/create-intelligence.ts   the factory: config in, one model per agent out
  provider/                        openrouter, gateway              → reference/providers.md
  middleware/                      agent, cost, logging, schema-instruction → reference/middleware.md
  model/fallback-model.ts          the one model wrapper that is no middleware
  formatting/                      the text utilities, which never import `ai`
  index.ts, index.formatting.ts    the entries of `.` and `./formatting`
lint/
  index.config.ts, index.oxlint.ts the entries of `./config` and `./oxlint`
  consumer/                        the rules every consumer is held to → reference/lint-rules.md
  kit/project/                     what the rules read of a file and its path
```

Four entries, one package, each built from the source the entry grammar names:

| Entry          | Holds                                                                 | Built as  | Loads                                  |
| -------------- | --------------------------------------------------------------------- | --------- | -------------------------------------- |
| `.`            | the factory, the providers, the middleware, the fallback model        | ESM + CJS | `ai`, the provider SDKs, OpenTelemetry |
| `./formatting` | `cleanAiText`, `toSentenceCase`                                       | ESM + CJS | the Hunspell dictionaries, never `ai`  |
| `./config`     | `intelligence()`, the preset a consumer lists in `jterrazz.config.ts` | ESM       | `@jterrazz/typescript`                 |
| `./oxlint`     | the oxlint plugin and `recommendedRules`                              | ESM       | `@jterrazz/typescript/rules`           |

`ai` and `@jterrazz/typescript` are optional peers: a consumer that only cleans text installs neither, and only a repository on the `@jterrazz` toolchain loads the preset — which is why `./config` and `./oxlint`, read by that toolchain's ESM loaders alone, ship no CommonJS build.

## What `createIntelligence` wires

For each agent, on its first `intelligence.model(agentName)`:

1. the provider's model, from `createOpenRouterProvider` or `createGatewayProvider`, each provider built once and shared by the agents naming it;
2. `createAgentMiddleware` — names the AI SDK's inference span after the agent, with `gen_ai.agent.name`, so a backend reading that span alone (Langfuse) knows which agent generated;
3. `createCostMiddleware` — writes the generation's USD cost on the same span, with the agent's `pricing` entry, keyed `"<provider>/<model>"`;
4. when the agent names a `fallback`, `createFallbackModel` over the primary and the fallback, each built by steps 1–3;
5. when the configuration carries a `logger`, `createLoggingMiddleware` around the whole.

The model is cached by agent name, so a second call hands back the same instance. An agent the configuration does not declare, or an agent on an undeclared provider, is refused on that call, the error naming what does exist. `createIntelligence` also registers the AI SDK's OpenTelemetry integration (`@ai-sdk/otel`), once per process: the spans go wherever the host's OpenTelemetry SDK sends them, and nowhere when it registered none.

## The model layer

`createFallbackModel` returns a `LanguageModelV4`, not a middleware: a middleware transforms one model's calls, and cannot swap the model under them. It hands a call to the fallback only on an error the AI SDK marks retryable — a `408`, `409`, `429` or `5xx` answer, or a network failure. Any other error, a `400` among them, reaches the caller unchanged, and a switch is logged as `ai.fallback.triggered` when a logger is configured.

## The agent convention

The package assumes a consumer lays its agents out one folder each, the prompt apart from the class that shapes the data for it:

```text
agents/<name>/<name>.ts          the agent class — SCHEMA, constructor(model, …), run()
agents/<name>/<name>.prompt.ts   the prompt, and only the prompt
agents/_shared/<name>.prompt.ts  sections several agents share
composition/                     where the factory is called and each model resolved
```

The class only shapes data — filter, sort, map to flat records — and hands the prompt's builders plain values, never assembled prose; `generateText` stays visible in `run()`. A `*.prompt.ts` holds pure `(data) => string` builders, a main one and the sections it calls. The preset of `./config` makes the convention mechanical: a consumer lists `intelligence()` in its `jterrazz.config.ts`, and the six rules of [Lint rules](../reference/lint-rules.md) judge its tree on every `typescript check`.

## Formatting

`./formatting` is free of the AI SDK. `cleanAiText` removes what a model leaves in its text — a byte-order mark, invisible and control characters, citation markers — and normalizes line endings, smart quotes, dashes, spaces and Unicode (NFKC). `toSentenceCase` folds a Title Case title back to sentence case, keeping acronyms and genuine proper nouns: the proper nouns come from `src/formatting/preserved-terms.generated.ts`, which `npm run generate:terms` writes from three cspell dictionaries and `dictionary-en`, and the common words from the Hunspell dictionaries it reads from disk at runtime. That runtime read is why a Next.js consumer lists the package in `serverExternalPackages`: a bundled copy loses the dictionaries' path.

## Related

- [Providers](../reference/providers.md) and [Middleware](../reference/middleware.md) — each block, called on its own.
- [Develop](../guides/develop.md) — where a new provider, middleware or rule goes.
