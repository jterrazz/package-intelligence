# Release

This repository ships one thing: the npm package `@jterrazz/intelligence`, published to the public registry (`publishConfig.registry` in `package.json`). There is no service, no image and no infrastructure of its own — releasing it is the whole of shipping it, and this guide is how it is cut and who cuts it.

## What ships

`files: ["dist"]`: the build of the four entries ([Architecture](../concepts/architecture.md#the-building-blocks)), their declarations and source maps, beside `package.json`, the README and the license. `src/`, `lint/`, `specs/`, `docs/` and `scripts/` never leave the repository. The `cli` specs install exactly that tarball in a consumer's project ([Test](test.md#the-specs)).

## What a merge to `main` does

Nothing that reaches a consumer. `.github/workflows/validate.yaml` runs on every push and pull request to `main` and calls the shared `jterrazz-actions` validation workflow — build, lint, test, mutation. A green `main` is a publishable tree, not a published one.

## What publishes

`.github/workflows/release.yaml` fires on `release: created` and calls the shared `release-npm.yaml` workflow with npm provenance (`id-token: write`). Exactly one gesture publishes, and a human makes it: cutting a GitHub Release.

1. the change merges to `main` and validates green;
2. the owner bumps `version` in `package.json` (and the lockfile) on `main`;
3. the owner tags `vX.Y.Z` and creates the GitHub Release;
4. the workflow builds and publishes the package to npm.

A contributor never bumps the version inside a feature branch: two branches in flight would both claim the same number.

## How a consumer takes it

A consumer installs `@jterrazz/intelligence` beside `ai`, and a repository on the `@jterrazz` toolchain lists `intelligence()` in its `jterrazz.config.ts`. A bump is an ordinary dependency update; a renamed rule, a narrowed type or an entry dropped is a major, recorded in the release notes.

## Related

- [Test](test.md) — what the validation runs before a release is possible.
