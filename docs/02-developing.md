# Developing

How this package is changed: the toolchain, where a new file goes, the
preserved-terms generator, and what a change owes before it ships. What the
package IS is [01-architecture.md](01-architecture.md); what proves a change
once written is [03-testing.md](03-testing.md).

## The toolchain

```bash
npm ci             # or `make install`
npm run build      # tsdown — three entries: index, formatting, oxlint
npm run lint       # typescript check — tsc, oxlint, oxfmt, gitignore, knip, docs
npm run lint:fix   # typescript fix
npm test           # vitest --run
```

`Makefile` mirrors the same four as `install`/`build`/`lint`/`test`, each
depending on `node_modules/.install` (a `npm ci` gated on `package-lock.json`
so a repeat run is a no-op). `tsconfig.json`, `oxlint.config.ts` and
`oxfmt.config.ts` extend `@jterrazz/typescript`'s `node` presets and add
nothing project-specific beyond `skipLibCheck` and the `scripts/` include —
the presets and the gates they run are that package's own
(`@jterrazz/typescript`'s `docs/06-quality-checks.md`), not restated here.

`knip.json` ignores `dictionary-en`, `dictionary-fr`,
`@cspell/dict-companies` and `@cspell/dict-software-terms`: all four are read
straight out of `node_modules` by `scripts/generate-preserved-terms.ts`
rather than imported, so knip's static analysis cannot see the use and would
otherwise flag them as unused.

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
       `tests/lint-fixtures/lint-violations/<id>/` (a violation) and
       `<id>-ok/` (its compliant twin), plus a line in
       `tests/lint-fixtures/lint-violations/oxlint.e2e.json` and in the
       `RULES` array of `tests/lint/oxlint-rules.e2e.test.ts`.

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
- The lint plugin's E2E suite (`tests/lint/oxlint-rules.e2e.test.ts`) loads
  the BUILT plugin (`dist/oxlint.js`), never `src/lint/plugin.ts` directly —
  run `npm run build` before it after touching a rule, or trust `npm test`
  which does not rebuild for you.
- A change to the public API (`src/index.ts`, `src/formatting.ts`, or the
  lint plugin's exports) updates `README.md`'s quick-start and the export it
  touched in [01-architecture.md](01-architecture.md).
