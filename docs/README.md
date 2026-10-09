# @jterrazz/intelligence — the manual

A thin composition layer over AI SDK v7: provider factories, cost, fallback and logging middleware, a config-driven factory that wires them, the text utilities of `./formatting`, and the `intelligence()` preset that holds a consumer's agents to their convention. What the package is and how a consumer starts is the repository's README; this page lists every page of the manual, by what the reader came to do.

## Guides

| Page                         | Answers                                                                                       |
| ---------------------------- | --------------------------------------------------------------------------------------------- |
| [Develop](guides/develop.md) | Changing the package: the declaration, the gestures, where a new file goes, what it owes      |
| [Test](guides/test.md)       | Proving a change: the specs, the declared providers, the tarball, the lint rules, the mutants |
| [Release](guides/release.md) | How the package is published, and who cuts a release                                          |

## Concepts

| Page                                     | Answers                                                                                     |
| ---------------------------------------- | ------------------------------------------------------------------------------------------- |
| [Architecture](concepts/architecture.md) | The building blocks, what `createIntelligence` wires, the entries, and the agent convention |

## Reference

| Page                                  | Answers                                                                         |
| ------------------------------------- | ------------------------------------------------------------------------------- |
| [Providers](reference/providers.md)   | The OpenRouter and gateway providers: what each sends, and what wraps its model |
| [Middleware](reference/middleware.md) | The agent, cost, logging and schema-instruction middleware, and the fallback    |
| [Lint rules](reference/lint-rules.md) | The `intelligence()` preset and every rule it holds a consumer to               |

## Decisions

The records of decisions this package alone took are in [`decisions/`](decisions/), numbered in the order they were taken, the mold `_template.md` beside them. A decision spanning several repositories is recorded by the corpus that spans them.
