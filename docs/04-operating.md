# Operating

This repository ships a published npm package and nothing else — there is
no server, no image, no Dockerfile. What follows is what publishes it and
what does not.

## What is published

`@jterrazz/intelligence` on the public npm registry
(`publishConfig.registry`), `files: ["dist"]` — only the tsdown build
output ships; `src/`, `tests/`, `docs/`, `scripts/` and the lint fixtures do
not leave the repository. The `exports` map
([01-architecture.md](01-architecture.md)) is the consumer-facing surface:
`.`, `./formatting`, `./oxlint`, each an ESM+CJS pair with its own `.d.ts`.

## What triggers a release

`.github/workflows/release.yaml` fires on `release: created` — a GitHub
Release, not a push to `main` — and delegates to the shared reusable
workflow `jterrazz/jterrazz-actions/.github/workflows/release-npm.yaml`
(Node 24, `id-token: write` for npm provenance). Cutting the release is what
publishes; nothing in this repository's own workflow decides the version or
runs `npm publish` directly.

`.github/workflows/validate.yaml` fires on every push and pull request
against `main` and delegates to the shared
`jterrazz/jterrazz-actions/.github/workflows/validate.yaml` — it is the gate
a change must pass, and it publishes nothing.

**A merge to `main` deploys nothing.** This package has no path filter to
read either way: the validate workflow runs on every push regardless of
which files changed, and only a separately-created GitHub Release triggers
`release.yaml`. A docs-only commit merged to `main` is validated like any
other and never reaches npm.

## Taking a bump

A consumer bumps the `@jterrazz/intelligence` devDependency/dependency
version in its own `package.json` and reinstalls; there is no migration
gesture beyond what the package's own `docs/decisions/` records for a given
version.
