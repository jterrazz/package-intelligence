# Test

What proves a change here is a specification of what a consumer meets: the factory, the providers and the middleware called against declared providers, the rules run by the real oxlint over a tree, and the tarball `npm pack` writes installed in a consumer's project. Module tests are kept for a pure algorithm and for a rule's visitor on snippets.

```bash
make test       # builds, then typescript test: the specs and module tests the change reaches, none on a proven tree
make mutation   # the zero-survivor verdict over the change
npm run docs    # rewrites the rule catalogue the chapter test compares
```

## The specs

**`specs/integration/`** calls the package through its source entries on a runner with no services: what earns the folder is the outside world the calls meet (the gateway and OpenRouter, declared as stubs over HTTP) and the goldens. No provider SDK is doubled: each call leaves through the real `@ai-sdk/openai` or `@openrouter/ai-sdk-provider` client, and a stub answers it in the provider's wire format.

| Spec                                        | Proves                                                                                                                                                                                                                                                                                               |
| ------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `intelligence/resolution.spec.ts`           | an agent answers through its provider, under its model id and its credentials; OpenRouter's attribution headers, and none without metadata; a keyless gateway gets no token; an undeclared agent or provider is refused, naming what exists; one model per agent; an answer on a host with no tracer |
| `intelligence/fallback.spec.ts`             | a `500`, a `429` on a stream and an unreachable primary hand the call to the fallback, the switch logged; a `400` reaches the caller and the fallback is never called                                                                                                                                |
| `intelligence/telemetry.spec.ts`            | the inference span renamed after the agent, its cost from the pricing, from OpenRouter's report, from the pricing again when OpenRouter reports zero, and none when nothing prices it; a stream costed from its last chunk's usage; the logger's events                                              |
| `intelligence/structured-output.spec.ts`    | a gateway asked for an object is told the schema in the prompt, and its fenced JSON is read as the object                                                                                                                                                                                            |
| `schema-instruction/prompt.spec.ts`         | where the instruction lands in each shape of prompt, read back from what OpenRouter received; a text request sent as written                                                                                                                                                                         |
| `logging/include.spec.ts`, `errors.spec.ts` | what each `include` option adds or removes, the answer's text logged without its reasoning, and a refused generation or stream logged as an error before it reaches the caller, on a clock that stands still, so every duration logged is zero                                                       |
| `formatting/to-sentence-case.spec.ts`       | one table of titles, each against its golden under `__expected__/`                                                                                                                                                                                                                                   |

`telemetry.spec.ts` registers an OpenTelemetry tracer whose spans stay in memory, and reads what this package wrote on them; no other spec file registers one, which is what proves a host with no tracer is served. `__setup__/providers.ts` names the two providers' addresses and a configuration declaring both, and `__setup__/logger.ts` a logger that keeps what it is told. A stub filter is the assertion: a request without the model id, the key or the header a stub names matches nothing, and a `required` stub nobody called fails the chain.

The sentence-case answers are decided by data (the generated preserved terms and the Hunspell dictionaries), so `npm run generate:terms` can move a golden: read the diff, and record it with `TEST_UPDATE=1 npx vitest --run --project integration` when it is the answer you meant.

**`specs/lint/`** runs the real oxlint with the built plugin (`dist/oxlint.js`) over a tree each spec lays down, and compares the whole report: one folder per rule, its violation tree beside it, and `conventional-project/`, an agent project laid out by the convention, which every rule passes.

**`specs/cli/`** runs `node` in a consumer's project (`node/__fixtures__/consumer/`) with the packed package installed by `.link('@jterrazz/intelligence', packed())`:

| Spec                        | Proves                                                                                                                       |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `node/subpaths.spec.ts`     | each of the four entries loads from the tarball under every condition it declares, naming its reviewed API                   |
| `node/declarations.spec.ts` | a consumer's configuration and middleware compile against the shipped `.d.ts`, and an unknown provider type is refused there |

The lint and packaging specs read `dist/`: `make test` builds first, but a spec run on its own straight after an edit reads the previous build, so run `make build` before it.

## Module tests

| Test                                                    | Holds                                                                                         |
| ------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `src/formatting/__tests__/clean-ai-text.test.ts`        | one table of what `cleanAiText` removes and normalizes, with each option                      |
| `lint/consumer/rules/<family>/__tests__/<rule>.test.ts` | each rule's visitor on snippets, through `ruleTester()`: every finding at its line and column |
| `lint/consumer/rules/__tests__/plugin.test.ts`          | the plugin registers one rule per catalogue row, each carrying its row                        |
| `lint/consumer/rulebook/__tests__/preset.test.ts`       | the preset, whole: the plugin by its published subpath, every rule on at `error`              |
| `lint/self/corpus/__tests__/catalogue.test.ts`          | the chapter holds the catalogue as the rows write it, and every lesson's anchor is in it      |

## What earns a test

A behaviour a consumer relies on is specified through the surface the consumer meets. A module test is kept only for a pure algorithm whose edges are cheaper at its own level, or for a failure no consumer's call can provoke honestly. The module tests of the factory, the middleware and the fallback model drove doubles of the provider SDKs (`vi.mock` of `@ai-sdk/openai` and `@openrouter/ai-sdk-provider`, spies on the active span) and were replaced by the specs above, which met two defects the doubles hid: a stream was never costed, and a keyless gateway failed every call, or would have sent the process's `OPENAI_API_KEY` to the gateway.

## What no spec proves

No suite reaches a live provider: the stubs state what the gateway and OpenRouter answer, and nothing runs them against the real services. A change of a provider's wire format shows in production, not here.

## Mutation

`make mutation` runs `typescript mutation`: Stryker mutates the lines a change touched, and the whole suite runs against each mutant. A mutant that a test runs and none detects fails the gate. With nothing uncommitted on a branch it measures `merge-base..HEAD` (the last commit alone on the default branch) and prints that range in its verdict; `--since <commit>` names another base ([Quality checks § Mutation](https://github.com/jterrazz/package-typescript/blob/main/docs/reference/quality-checks.md#mutation)). Every source is measured with `--mutate`, its ranges comma-separated:

```bash
npx typescript mutation --mutate "$(git ls-files src lint/consumer lint/kit lint/index.*.ts | grep -E '\.ts$' | grep -v -e __tests__ -e generated | sed 's/$/:1-400/' | paste -sd, -)"
```

Over every source, the suite detects every mutant it runs. A mutant no change of behaviour can tell apart (a cache, a version string the AI SDK never reads, the narrowing TypeScript needs) carries a `Stryker disable` directive stating why, beside the line.

## Related

- [Develop](develop.md): the gestures, and where a new file goes.
- [Providers](../reference/providers.md): what each provider sends, which the stubs declare.
