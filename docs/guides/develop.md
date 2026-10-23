# Develop

How a change to this package is made: the declaration every config follows, the gestures, where a new file goes, and what a change owes. What the package is made of is [Architecture](../concepts/architecture.md).

## The declaration

`@jterrazz/typescript` supplies the whole toolchain (build, type-check, lint, format, unused code, mutation) from one devDependency, and `jterrazz.config.ts` says what this package is: a `library` on `node`, held to `@jterrazz/test`'s preset and to its own, `intelligence()`, loaded from its build by `ownPresets`. Every other config follows from that file:

- `oxlint.config.ts`, `oxfmt.config.ts`, `tsconfig.json` and `vitest.config.ts` are the one-line derivations `typescript fix` writes and `typescript check` refuses to see edited;
- knip, the build and Stryker are configured by the commands that run them, from the declaration and the manifest;
- the four entries are read off `package.json#exports` and built from the sources the entry grammar names: `src/index.ts`, `src/index.formatting.ts`, `lint/index.config.ts`, `lint/index.oxlint.ts`.

Every exception the package takes to the standard is declared in [`jterrazz.config.ts`](../../jterrazz.config.ts), each with its reason beside it: the roots beside the spine, the dependencies knip cannot see used, and the oxlint overrides. No debt is recorded: there is no `.jterrazz/` ledger. The package holds itself to its own preset, so its rules judge this tree too.

## The gestures

| Gesture                  | Runs                                                                                                            |
| ------------------------ | --------------------------------------------------------------------------------------------------------------- |
| `make install`           | `npm ci`, once per change of the lockfile                                                                       |
| `make build`             | `typescript build`: the four entries, into `dist/`                                                              |
| `make lint`              | `typescript check`, every pass, after a build: its own preset loads from `dist/`, and the Publish pass reads it |
| `make fix`               | `typescript fix`, after a build: the derived files, the formatter, the fixable findings                         |
| `make test`              | the specs and module tests, after a build: the lint and packaging specs read `dist/` ([Test](test.md))          |
| `make mutation`          | `typescript mutation`: the zero-survivor verdict over the change ([Test](test.md#mutation))                     |
| `make check`             | `make lint`, `make test`, then `make mutation`: the gate before a commit                                        |
| `npm run docs`           | rewrites the rule catalogue of [Lint rules](../reference/lint-rules.md) from the catalogue's rows               |
| `npm run generate:terms` | rewrites `src/formatting/preserved-terms.generated.ts` ([below](#the-preserved-terms-generator))                |

Build, test and lint output lands under `.artifacts/`, which `.gitignore` ignores whole; `dist/` is the published product, not an artefact.

## Where a new file goes

| Adding                           | Goes in                                                                                                                                                                                                    |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| a provider                       | `src/provider/<name>.provider.ts`, exported from `src/index.ts`; its config joins the `ProviderConfig` union, and `createProvider` in `src/factory/create-intelligence.ts` gains the branch for its `type` |
| a middleware                     | `src/middleware/<name>.middleware.ts`, exported from `src/index.ts`                                                                                                                                        |
| a text utility                   | `src/formatting/<name>.ts`, exported from `src/index.formatting.ts`, never importing `ai`                                                                                                                  |
| a lint rule                      | [below](#a-lint-rule)                                                                                                                                                                                      |
| a behaviour a consumer relies on | a spec under `specs/integration/<subject>/` ([Test](test.md))                                                                                                                                              |
| a module test                    | `<folder>/__tests__/<module>.test.ts`, kept only on the criteria [Test](test.md#what-earns-a-test) names                                                                                                   |

### A lint rule

A rule ships with four pieces, in the folders the lint tree closes ([`@jterrazz/typescript`'s lint tree](https://github.com/jterrazz/package-typescript/blob/main/docs/reference/quality-checks.md#the-lint-tree)):

1. its row in `lint/consumer/catalogue/manifest.ts` (`name`, `family`, `sentence`, `why`, `fix`), its family one of `families.ts`;
2. the rule, `lint/consumer/rules/<family>/<name>.ts`, written with `defineRule` of `@jterrazz/typescript/rules` from that row, and registered in `lint/consumer/rules/plugin.ts`; the preset turns it on from the catalogue, at `error`;
3. its module test, `lint/consumer/rules/<family>/__tests__/<name>.test.ts`: `ruleTester()` of `@jterrazz/test` over snippets, every finding at its line and column;
4. its lint spec, `specs/lint/<name>/<aspect>.spec.ts`, over a tree that breaks it; then `npm run docs` writes its row into [Lint rules](../reference/lint-rules.md), the anchor every finding's `read` names.

`lint/consumer/rules/__tests__/plugin.test.ts` refuses a row with no rule and a rule with no row; `lint/self/corpus/__tests__/catalogue.test.ts` refuses a chapter the rows would write otherwise, or a lesson whose anchor the chapter lacks. `lint/self/` is the repository's own, which no entry reaches: `chapters.cli.ts`, which `npm run docs` runs, the projection it writes in `corpus/`, and no rule (a rule that judges only this repository would sit there).

## The preserved-terms generator

`npm run generate:terms` runs `scripts/generate-preserved-terms.ts` and formats what it writes: `src/formatting/preserved-terms.generated.ts`, the proper nouns `toSentenceCase` keeps, from three cspell dictionaries, minus every term `dictionary-en` holds as a lowercase word. Rerun it when one of those devDependencies moves; the file is committed, so a change of answer is a diff a reviewer reads, and the sentence-case goldens show what it changed ([Test](test.md)).

## What a change owes

A new or changed export reaches the root `README.md`, the page of this manual that owns it and the `skills/jterrazz-intelligence/` skill in the same change: none of the three is generated, so nothing catches a stale one. A comment states the kind of thing the code cannot say (`invariant:`, `hazard:`, `outside:`, `value:`) or is not written; a public symbol keeps a one-line hover.

- Every export a consumer reaches passes through an entry: no deep import path is public API.
- An observing middleware never changes what a generation answers: it reads and writes the span or the logger, and hands the call's result on as it came.
- `./formatting` never imports `ai`: a consumer cleaning text installs no AI SDK.

## Related

- [Architecture](../concepts/architecture.md): the blocks these files implement.
- [Test](test.md): how a change to one of them is proven.
