# Testing

What proves a change: three layers of vitest, run in one pass by `npm test`
(`vitest --run`, no config file — vitest's own defaults discover every
`*.test.ts` under the tree). There is no golden or fixture-recording
convention here; a scenario is an ordinary `describe`/`test`, `// Given` /
`// Then` commented as `@jterrazz/test`'s shape states.

## Unit tests

Co-located `*.test.ts` beside the source they prove — `src/factory/`,
`src/middleware/`, `src/model/`, `src/formatting/` and `src/lint/rules/` each
carry their own. A provider or middleware factory is exercised against a
mocked AI SDK model (`vi.mock('@openrouter/ai-sdk-provider', …)` in
`create-intelligence.test.ts`) or a `MockLanguageModelV4` from `ai/test`,
never a live network call. Each oxlint rule's own `.test.ts` runs it through
`RuleTester` against inline valid/invalid code samples — the fast,
in-process layer of the lint plugin's proof.

## The composition integration test

`tests/integration/composition.integration.test.ts` wraps a REAL
`LanguageModelV4` (`MockLanguageModelV4`, deterministic but shaped exactly
like a live model) with `createCostMiddleware`, `createLoggingMiddleware` and
`createFallbackModel` together, and asserts the three interact correctly —
cost lands on the active span, the logger receives both `start`/`complete`
events, and a retryable failure on the primary trips the fallback. It is the
one place the pieces of [01-architecture.md](01-architecture.md)'s pipeline
are proven composed, rather than each proven alone.

## The lint plugin's own proof

Two more layers guard the oxlint plugin beyond each rule's `RuleTester`:

- **The completeness meta-test**, `src/lint/plugin.test.ts` — mirrors
  `@jterrazz/test`'s own `src/lint/plugin.test.ts`. It asserts every rule in
  `plugin.rules` carries a `meta.docs` sourced from `RULE_DOCS`, that the
  manifest and the plugin cover exactly the same rule set (no orphan doc, no
  undocumented rule), that every manifest id is unique, that the
  `intelligence` fragment is self-sufficient (registers the plugin, enables
  every rule, carries no `extends`), that severities follow the `<id>w-*` →
  `warn` convention, and — the inventory check — that every rule in
  `plugin.rules` has BOTH a `src/lint/rules/<id>.test.ts` and a fixture pair
  under `tests/lint-fixtures/lint-violations/<id>/` and `<id>-ok/`. Adding a
  rule without one of the six pieces [02-developing.md](02-developing.md)
  lists fails this test before anything else does.
- **The E2E fixture run**, `tests/lint/oxlint-rules.e2e.test.ts` — executes
  the REAL `oxlint` binary against the BUILT plugin (`dist/oxlint.js`), once
  per rule in its own `RULES` list, over the violation fixture (expects the
  diagnostic, and exit `1` for an `error`-severity rule) and the `-ok` twin
  (expects a clean run). This is the layer that proves the plugin as oxlint
  actually loads it, not as `RuleTester` simulates it — and it needs
  `npm run build` first: oxlint's JS-plugin loader takes a JS module, so the
  test always loads from `dist/`, never `src/lint/plugin.ts` directly.

## When a red run is not yours

A lint E2E test failing with "cannot find dist/oxlint.js" or a stale
diagnostic almost always means the plugin changed without a rebuild — run
`npm run build`, then `npm test` again, before suspecting the rule itself.
