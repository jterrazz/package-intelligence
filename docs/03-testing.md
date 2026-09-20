# Testing

What proves a change: two vitest projects over one tree, both run by
`npm test`. Where a test file lives decides which project collects it, and the
fork is `@jterrazz/test`'s, not a preference of this repository.

| Project       | Collects                            | Proves                                                     |
| ------------- | ----------------------------------- | ---------------------------------------------------------- |
| `unit`        | `<file>.test.ts` beside `<file>.ts` | one module alone, against doubles it builds itself         |
| `integration` | `specs/integration/<domain>/`       | a module whose oracle is a golden, or that needs a process |

`vitest.config.ts` states nothing but those two projects on top of
`defineSpecConfig()`: the 30 s budgets, the `.artifacts/vitest` cache
directory and the `_fixtures/` exclusion are the preset's, and the passes that
judge the suites are `oxlint.config.ts`'s `testing` fragment.

## Module tests

Co-located `*.test.ts` beside the source they prove — `src/factory/`,
`src/middleware/`, `src/model/`, `src/formatting/` and `src/lint/rules/` each
carry their own, and `src/formatting.test.ts` covers the dependency-free entry.

A provider or middleware factory is exercised against a mocked AI SDK model
(`vi.mock('@openrouter/ai-sdk-provider', …)` in `create-intelligence.test.ts`)
or a `MockLanguageModelV4` from `ai/test`, never a live network call. Each
oxlint rule's own `.test.ts` runs it through `RuleTester` against inline
valid/invalid code samples — the fast, in-process layer of the lint plugin's
proof.

## Integration specs

One runner serves the three domains: `specs/integration/integration.specification.ts`
calls `specification.integration()` with no services. Nothing starts — what
earns the facet here is the golden, or the process a spec spawns.

### The composed pipeline

`specs/integration/pipeline/composition.test.ts` wraps a REAL
`LanguageModelV4` (`MockLanguageModelV4`, deterministic but shaped exactly
like a live model) with `createCostMiddleware`, `createLoggingMiddleware` and
`createFallbackModel` together. The span and the logger are recorders, and
what they recorded is asserted whole against `_expected/*.json` — one golden
per case rather than a cluster of spy probes. It is the one place the pieces
of [01-architecture.md](01-architecture.md)'s pipeline are proven composed.

### The sentence-case table

`specs/integration/formatting/to-sentence-case.test.ts` is fifty-four
input/output rows around a single `.call()`, each row's oracle a golden under
`_expected/`. The answer is decided by DATA — the generated preserved-terms
list and the `dictionary-en`/`dictionary-fr` Hunspell sets — so regenerating
either is a `TEST_UPDATE=1` diff a reviewer reads, not fifty-four hand edits.

### The lint plugin's E2E run

`specs/integration/lint/rules.test.ts` executes the REAL `oxlint` binary
against the BUILT plugin (`dist/oxlint.js`), once per rule in its own `RULES`
list, over the violation fixture (expects the diagnostic, and exit `1` for an
`error`-severity rule) and the `-ok` twin (expects a clean run). This is the
layer that proves the plugin as oxlint actually loads it, not as `RuleTester`
simulates it — and it needs `npm run build` first.

Each fixture is copied to a temp directory before it is linted. `m2w` exempts
any path carrying a `specs` segment, so a fixture linted where it is stored
would be judged by THIS repository's tree instead of the consumer tree it
stands for.

The assertion stays a rule-id probe rather than a full snapshot — the
sanctioned exception to `@jterrazz/test`'s D11, so the spec is not coupled to
a third party's diagnostic formatting.

## The completeness meta-test

`src/lint/plugin.test.ts` mirrors `@jterrazz/test`'s own `src/lint/plugin.test.ts`
(minus the docs-generation freshness checks: this package has no generated
catalogue). It asserts every rule in `plugin.rules` carries a `meta.docs`
sourced from `RULE_DOCS`, that the manifest and the plugin cover exactly the
same rule set, that every manifest id is unique, that the `intelligence`
fragment is self-sufficient, and that severities follow the `<id>w-*` → `warn`
convention.

Its inventory check is the one that catches a half-added rule: every rule in
`plugin.rules` must have BOTH a `src/lint/rules/<id>.test.ts` and a fixture
pair under `specs/integration/lint/_fixtures/<id>/` and `<id>-ok/`. Adding a
rule without one of the six pieces [02-developing.md](02-developing.md) lists
fails this test before anything else does.

## What the ledger holds against the suites

`oxlint.baseline.json` records 192 diagnostics across 9 rules, four of which
are the suites' rather than the source's:

- `vitest/require-mock-type-parameters`, 73 — `vi.fn()` doubles that name no
  function type, across the module tests.
- `jterrazz/i4-no-vi-mock-in-src`, 2 — the `vi.mock` calls that stand in for
  the provider SDKs in `src/factory/create-intelligence.test.ts`.
- `typescript/no-unsafe-assignment`, 1 — `expect.any(Number)` is typed `any`,
  named once as `ANY_DURATION_MS` in `logging.middleware.test.ts`.
- `eslint/no-await-in-loop`, 1 — the manual drain of the cost middleware's
  stream in `cost.middleware.test.ts`.

The ratchet may only shrink. Paying it down is a session of its own, one rule
at a time, never a rider on a feature.

## When a red run is not yours

A lint E2E test failing with "cannot find dist/oxlint.js" or a stale
diagnostic almost always means the plugin changed without a rebuild — run
`npm run build`, then `npm test` again, before suspecting the rule itself.

A golden failing after `npm run generate:terms` is the generator's answer
changing, not the spec breaking: read the diff, and record it with
`TEST_UPDATE=1 npx vitest --run --project integration` when it is the answer
you meant.
