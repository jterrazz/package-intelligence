# Developing

How this package is changed: the toolchain, where a new file goes, the
preserved-terms generator, and what a change owes before it ships. What the
package IS is [01-architecture.md](01-architecture.md); what proves a change
once written is [03-testing.md](03-testing.md).

## The toolchain

```bash
npm ci             # or `make install`
npm run build      # tsdown — three entries: index, formatting, oxlint
npm run lint       # typescript check — the twelve passes of @jterrazz/typescript
npm run lint:fix   # typescript fix
npm test           # vitest --run — both projects, unit and integration
```

`Makefile` mirrors the same four as `install`/`build`/`lint`/`test`, each
depending on `node_modules/.install` (a `npm ci` gated on `package-lock.json`
so a repeat run is a no-op). **`npm run build` precedes `npm run lint`**: the
lint config loads this package's own plugin from `dist/`, so a tree that has
never been built has no rulebook to lint itself with.

`tsconfig.json` and `oxfmt.config.ts` name `@jterrazz/typescript`'s
`library` profile and nothing else — no local `compilerOptions`, no
`include` of its own. `vitest.config.ts` is the same gesture for the suites:
`defineSpecConfig()` from `@jterrazz/test`, carrying the two projects
[03-testing.md](03-testing.md) describes and no budget of its own. `oxlint.config.ts` composes three fragments and no
local rulebook: that same `library`, `@jterrazz/test`'s `testing` — the
conventions the suites answer to, the shape every repository of the estate
with tests uses — and this package's own `intelligence`. The presets, the passes they run
and the `oxlint.baseline.json` ratchet are that package's own
(`@jterrazz/typescript`'s `docs/06-quality-checks.md`), not restated here.

The one rule this project turns off is `intelligence/m1-model-resolution-in-container`,
and `oxlint.config.ts` carries the reason beside it: M1 gates a CONSUMER's composition root, and this
package defines the factories M1 names, so every call in this tree is that
definition or its own test. Everything else the rulebook still finds is
recorded in `oxlint.baseline.json` — a ratchet that may only shrink.

`knip.json` ignores six dependencies, each with its reason beside it: the
four dictionaries `scripts/generate-preserved-terms.ts` reads straight out of
`node_modules` (never imports, so knip cannot see the use), `oxlint` — whose
`plugins-dev` `RuleTester` and binary are the SUBJECT of `src/lint/`, answered
by the one copy `@jterrazz/typescript` installs — and `@types/json-schema`,
which the generated `dist/*.d.ts` reaches through the AI SDK's own types.

## Where a new file goes

- **A provider** — `src/provider/<name>.provider.ts`, exporting a factory
  and its config/return types, then wired into `ProviderConfig`'s union and
  `createProvider`'s `switch` in `src/factory/create-intelligence.ts`, and
  re-exported from `src/index.ts`. The shape to copy is
  [05-providers.md](05-providers.md)'s.
- **A middleware or the fallback model** — `src/middleware/<name>.middleware.ts`
  or `src/model/<name>.ts`, a sibling `.test.ts`, and an export from
  `src/index.ts`. Every enrichment middleware (agent, cost) is best-effort —
  it never throws, so a broken telemetry backend never breaks a generation;
  copy that `try`/`catch` shape from `src/middleware/cost.middleware.ts`
  rather than inventing a new failure posture.
- **An oxlint rule** — six files move together, and a rule is not shipped
  until all six exist:

    1. `src/lint/rules/<id>.ts` — the rule, plus a `RuleTester` spec
       `src/lint/rules/<id>.test.ts`.
    2. `src/lint/manifest.ts` — the `RULE_DOCS[<id>]` entry (`id`,
       `convention`, `rationale`) the rule's `meta.docs` attaches.
    3. `src/lint/plugin.ts` — the rule added to `plugin.rules`; `recommendedRules`
       needs no separate edit, since it is derived from that map's keys, at
       `error` unless the id's own segment ends in `w` (`m2w-…` → `warn`).
    4. `docs/01-architecture.md`'s rule table — one row.
    5. A fixture pair under
       `specs/integration/lint/_fixtures/<id>/` (a violation) and
       `<id>-ok/` (its compliant twin), plus a line in
       `specs/integration/lint/_fixtures/oxlint.e2e.json` and in the
       `RULES` array of `specs/integration/lint/rules.spec.ts`.

    `src/lint/plugin.test.ts` is the completeness meta-test that refuses a
    rule missing any of the first three — see
    [03-testing.md](03-testing.md).

## The preserved-terms generator

`npm run generate:terms` runs `scripts/generate-preserved-terms.ts` and
formats its output — it rebuilds
`src/formatting/preserved-terms.generated.ts`, the proper-noun list
`toSentenceCase` preserves, from three cspell dictionaries plus
`dictionary-en`'s lowercase headwords (the ambiguity filter: a term kept only
when it never appears as an ordinary lowercase word). Re-run it whenever
those devDependencies are bumped; the generated file is committed, so a
drift is a diff a reviewer sees, not a silent runtime difference.

## What a change owes

- A change to the agent/prompt convention or its rule table updates
  `docs/01-architecture.md` in the same commit — the manifest's
  `RULE_DOCS` is the machine-facing text, the chapter is the human-facing
  one, and neither restates the other's wording.
- The lint plugin's E2E suite (`specs/integration/lint/rules.spec.ts`) and
  `oxlint.config.ts` both load the BUILT plugin (`dist/oxlint.js`), never
  `src/lint/plugin.ts` directly — run `npm run build` after touching a rule,
  before either `npm test` or `npm run lint`, neither of which rebuilds for
  you.
- A change to the public API (`src/index.ts`, `src/formatting.ts`, or the
  lint plugin's exports) updates `README.md`'s quick-start and the export it
  touched in [01-architecture.md](01-architecture.md).
