# ADR-001: v6 — bare AI SDK, OTel-only, prompts are code

**Status:** Accepted
**Date:** 2026-07-18

Retroactive record, written 2026-09-04 from the validated decisions and the
`@jterrazz/intelligence@6.0.0` ship, both 2026-07-18. Moved into this
repository 2026-09-06, from the OS wiki where it was ADR-004 — this package
alone can falsify it.

## Context

v4/v5 carried its own structured-generation layer, JSON repair, a
vendor-specific observability adapter, and prompts scattered through agent
classes as inline strings.

## Decision

Three cuts, one convention:

- **Bare AI SDK, no framework layer.** `generateText` plus object output
  replaces the home-grown structured generation; fallback is a small native
  middleware. A `createIntelligence({ providers, agents })` factory hands each
  agent a primary model and a fallback by full technical name — no alias
  dictionary.
- **Observability is the OTel path only.** The vendor adapter and its
  dependency are deleted; traces flow through the host's collector, and any
  third-party sink is a fan-out at the collector, never in this package.
- **The gateway is a provider type.** A custom base-URL provider named
  `gateway` speaks the OpenAI chat-completions spec. Structured output through
  it is achieved by a schema-instruction middleware, because the proxy drops
  `response_format` silently — verified empirically against the live gateway,
  2026-07-18.
- **Prompts are code.** Every agent pairs `<name>.ts` (typed class, zero
  prompt strings) with `<name>.prompt.ts` (pure builder functions, composition
  by imports). Surveyed 2026-07-18: serious TypeScript AI codebases use typed
  builders and none load runtime markdown, so a prompt changes only by code
  review. The convention is enforced by this package's own oxlint plugin — no
  natural-language multiline literal outside `*.prompt.ts`, one prompt file per
  agent, model resolution only in the container.

## Consequences

- Consumers inject native `LanguageModel`s in their DI containers; agent
  config splits `provider:` and `model:` keys.
- The lint plugin caught a real drift in a consumer on first contact. The
  three-channel doctrine — `package-test`
  `docs/decisions/001-v9-conventions-on-three-channels.md` — generalizes
  beyond testing.
