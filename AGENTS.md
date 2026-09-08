# Agent brief — `@jterrazz/intelligence`

A thin composition layer over AI SDK v7: provider factories, cost/fallback/logging middleware, a config-driven factory, and an oxlint plugin mechanizing the agent/prompt convention. This file **routes**; it does not restate what the corpus already says.

## Where knowledge lives (route here first)

The corpus is `docs/` + `README.md`, mapped by [`docs/README.md`](docs/README.md). Decisions this package alone took are in [`docs/decisions/`](docs/decisions/). Do not duplicate it — link to it.

| Working on…                                         | Read                      |
| --------------------------------------------------- | ------------------------- |
| the building blocks, the pipeline, the lint plugin  | `docs/01-architecture.md` |
| the toolchain, where a new file goes                | `docs/02-developing.md`   |
| the unit, integration and lint-plugin suites        | `docs/03-testing.md`      |
| the release, and what a merge to `main` does not do | `docs/04-operating.md`    |
| OpenRouter and gateway providers                    | `docs/05-providers.md`    |
| agent, cost, logging, schema-instruction middleware | `docs/06-middleware.md`   |

`CLAUDE.md` at the root is a symlink to this file: one brief, two names, no second copy.

One Claude Code skill routes into this corpus: [`skills/jterrazz-intelligence/`](skills/jterrazz-intelligence/SKILL.md).

## Setup

```bash
npm ci
npm run build   # tsdown — required before the lint plugin's E2E suite can run
```

## Commands

| Task                       | Command                  |
| -------------------------- | ------------------------ |
| Run all tests              | `npm test`               |
| Lint + format + typecheck  | `npm run lint`           |
| Auto-fix lint issues       | `npm run lint:fix`       |
| Regenerate preserved terms | `npm run generate:terms` |

## Standing rule

A change to the agent/prompt convention or an oxlint rule moves in the same commit as the manifest entry, the plugin wiring, the fixture pair and the `docs/01-architecture.md` table row — the six pieces `docs/02-developing.md` lists. A change to the public API also updates the quick start in `README.md` and the export it touched in `docs/01-architecture.md`.
