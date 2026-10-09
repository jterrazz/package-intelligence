# Agent brief — `@jterrazz/intelligence`

A thin composition layer over AI SDK v7: provider factories, cost/fallback/logging middleware, a config-driven factory, and the `intelligence()` preset mechanizing the agent/prompt convention. This file **routes**; it does not restate what the corpus already says.

## Where knowledge lives (route here first)

The corpus is `docs/` + `README.md`, mapped by [`docs/README.md`](docs/README.md). Decisions this package alone took are in [`docs/decisions/`](docs/decisions/). Do not duplicate it — link to it.

| Working on…                                              | Read                            |
| -------------------------------------------------------- | ------------------------------- |
| the building blocks, the factory, the entries            | `docs/concepts/architecture.md` |
| the declaration, the gestures, where a new file goes     | `docs/guides/develop.md`        |
| the specs, the declared providers, the tarball, mutation | `docs/guides/test.md`           |
| the release, and who is allowed to cut one               | `docs/guides/release.md`        |
| OpenRouter and gateway providers                         | `docs/reference/providers.md`   |
| agent, cost, logging, schema instruction, fallback       | `docs/reference/middleware.md`  |
| the `intelligence()` preset and its rules                | `docs/reference/lint-rules.md`  |

The manual is cut by its reader's need — `guides/`, `concepts/`, `reference/` — the shape every repository of the ecosystem keeps, and `typescript check` refuses a tree that breaks it (the Docs (layout) pass).

`CLAUDE.md` at the root is a symlink to this file: one brief, two names, no second copy.

One Claude Code skill routes into this corpus: [`skills/jterrazz-intelligence/`](skills/jterrazz-intelligence/SKILL.md).

## Setup and commands

The gestures — `make install` (`npm ci`, never a plain `npm install`, which can rewrite the lockfile), `make build`, `make lint`, `make fix`, `make test`, `make mutation`, `make check` — and what each runs are [Develop § The gestures](docs/guides/develop.md#the-gestures)'s.

## Standing rule

A rule moves with its catalogue row, its module test, its lint spec and its section of `docs/reference/lint-rules.md` ([Develop § A lint rule](docs/guides/develop.md#a-lint-rule)). A new or changed export reaches `README.md`, the relevant `docs/` page and the `skills/jterrazz-intelligence/` skill in the same change ([Develop § What a change owes](docs/guides/develop.md#what-a-change-owes)).
