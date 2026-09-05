# @jterrazz/intelligence — documentation

A thin composition layer over the AI SDK: provider factories, cost, fallback and logging middleware, and a config-driven factory that wires them together. Every factory returns the AI SDK's own `LanguageModel`, so a consumer passes the result straight into `generateText` and friends.

The manual is still the [README](../README.md) — install, the `createIntelligence` factory, the provider types, the middleware, and the prompt conventions. Splitting it into numbered chapters is owed; until then, this file is the map and the README is the one chapter.

## Decisions

The records of decisions this package alone took are in [`decisions/`](decisions/), numbered in the order they were taken. A decision spanning several repositories is recorded by the corpus that spans them.
