# @jterrazz/intelligence — the corpus

The manual of this repository: what the package is, how it is changed, what
proves a change, how it ships, and its two product subjects. The vitrine —
install, quick start — is the root `README.md`, not this map.

| Chapter                                  | Holds                                                                                                                                  |
| ---------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| [01-architecture.md](01-architecture.md) | The building blocks and how `createIntelligence` wires them, the model and formatting layers, the lint plugin's shape, the exports map |
| [02-developing.md](02-developing.md)     | The toolchain, where a new provider/middleware/rule goes, the preserved-terms generator, what a change owes                            |
| [03-testing.md](03-testing.md)           | The unit and integration suites, the lint plugin's fixture-driven E2E, the manifest completeness meta-test                             |
| [04-operating.md](04-operating.md)       | What is published, what a GitHub Release triggers, and why a merge to `main` ships nothing                                             |
| [05-providers.md](05-providers.md)       | The OpenRouter and gateway providers                                                                                                   |
| [06-middleware.md](06-middleware.md)     | The agent, cost, logging and schema-instruction middleware                                                                             |

The decisions this package alone took stand in [decisions/](decisions/),
numbered and chronological, the mold `_template.md` beside them. A decision
spanning several repositories is not one of them — it belongs to the corpus
that spans them.
