# Lint rules

The `intelligence()` preset holds a consumer's agent code to [the agent convention](../concepts/architecture.md#the-agent-convention). A repository on the `@jterrazz` toolchain lists it beside its other presets, and `typescript check` runs its rules with the rest of the Oxlint pass:

```ts
// jterrazz.config.ts
import { intelligence } from '@jterrazz/intelligence/config';
import { test } from '@jterrazz/test/config';
import { defineConfig } from '@jterrazz/typescript/config';

export default defineConfig({
    kind: 'api',
    platform: 'node',
    presets: [test(), intelligence()],
});
```

The preset registers the plugin `@jterrazz/intelligence/oxlint` and turns every rule on at `error`: there is no warn tier, since the toolchain judges a warning as it judges an error. A rule the project sets aside is written under `typescript.oxlint`, with its reason. Each finding teaches in four parts: `found`, `why`, `fix`, and a `read` that is the rule's row below.

Each rule reads the file it lints and its path, never the project's settings: an agent folder is any `agents/<name>/` holding a `<name>.ts`, and the composition root is any file under a `composition/` folder. Where static reading cannot be sure, a rule catches the common slip rather than standing in for a type checker, and its row below says what it leaves out.

## The rules

<!-- GENERATED:catalogue, do not edit by hand; run `npm run docs`. Source: lint/consumer/catalogue/manifest.ts -->

### The agent class and the prompt it pairs with

| Rule                                                    | Holds                                                                                                                                                                                            | Why                                                                                                                                         | Fix                                                                                                                                      |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| <a id="agent-class-shape"></a>`agent-class-shape`       | An agent file (`agents/<name>/<name>.ts`) exports exactly one class; that class has a `static readonly SCHEMA` member, a `run` method, and a constructor whose first parameter is named `model`. | A fixed shape makes every agent class predictable to read and to wire from the composition root without re-deriving its contract each time. | export one class from the agent file, with a `static readonly SCHEMA`, a `run` method and a constructor whose first parameter is `model` |
| <a id="agent-prompt-sibling"></a>`agent-prompt-sibling` | An agent file (`agents/<name>/<name>.ts`) imports its prompt from `./<name>.prompt.js`; a `<name>.prompt.ts` outside a `_<subject>/` folder has its agent `<name>.ts` in the same folder.        | The two-way link makes the pairing mechanical: an orphaned prompt, or an agent that does not use its prompt, is almost always a mistake.    | import the prompt from `./<name>.prompt.js` in the agent file, or give the prompt file its agent `<name>.ts` beside it                   |

### Where a model is resolved, and where its id is written

| Rule                                                                          | Holds                                                                                                                                                                                                                                                                                                                       | Why                                                                                                                                  | Fix                                                                                                                  |
| ----------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------- |
| <a id="model-resolution-in-composition"></a>`model-resolution-in-composition` | `createIntelligence(...)`, `createGatewayProvider(...)` and `createOpenRouterProvider(...)` imported from `@jterrazz/intelligence`, and `.model('...')` with a literal name in a file importing it, are called only from the composition root, a file under `composition/`, or from a test, which composes its own subject. | Model resolution is the composition root's work: scattered, a provider or model choice drifts outside the one place meant to own it. | call the factory, and resolve the model by name, in a file under `composition/`, and hand the model to what needs it |
| <a id="no-hardcoded-model-id"></a>`no-hardcoded-model-id`                     | A string literal that reads as a model id (`claude-...`, `openai/gpt-...` and the like) sits only in a config, test, fixture or spec file.                                                                                                                                                                                  | A model id written in application code changes only with a deploy; in configuration it changes without one.                          | read the model id from configuration (the composition root names it) and keep the literal out of the code            |

### What a prompt file holds, and what it alone holds

| Rule                                                      | Holds                                                                                                                                                                                                      | Why                                                                                                                                            | Fix                                                                               |
| --------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| <a id="prompt-file-exports"></a>`prompt-file-exports`     | A `*.prompt.ts` file exports only `const` arrow functions returning a string, and types: no default export, no class, no other value.                                                                      | A closed export surface keeps a prompt file a pure builder: state, a class or a default export would invite prompt logic to grow side effects. | export only `const` arrow functions returning a string, and types                 |
| <a id="prose-in-prompt-files"></a>`prose-in-prompt-files` | Under an `agents/` folder, a file that is not a `*.prompt.ts` nor a `*.test.ts` holds no template literal of three lines or more that reads as prose: a line of four words or more, or a markdown heading. | The agent class only shapes data: prose that leaks into it hides the prompt contract, and the two can no longer be reviewed apart.             | move the prose into the sibling `*.prompt.ts`, as a function returning the string |

<!-- /GENERATED:catalogue -->

## What the rules leave out

- `agent-class-shape` sees a class exported where it is declared (`export class`, `export default class`), never one exported by name afterwards (`export { ArticleComposer }`), which it reads as an agent file exporting no class.
- `agent-prompt-sibling` reads the disk for a prompt's agent, so that half is met on a tree, never on a snippet.
- `model-resolution-in-composition` does not resolve what `.model()` is called on: an unrelated literal `.model()` in a file importing the package is a known false positive. It knows a factory by its import from `@jterrazz/intelligence`, named, renamed or through a namespace: a same-named function of the file's own passes, and so does a factory a local module re-exports.
- `no-hardcoded-model-id` knows the families `claude`, `deepseek`, `gemini`, `gpt`, `grok`, `llama`, `mistral` and the `o<digit>` series, bare or behind a provider prefix, and exempts a file named `*.config.*`, `*.test.*` or `*.spec.*`, or under a `config/` folder or a folder of the tests: `specs/`, `__tests__/`, `__setup__/` and the ground folders the toolchain names, `__expected__/`, `__fixtures__/`, `__requests__/` and `__seeds__/`.
- `prompt-file-exports` reads the shape of each return, not its type: a call, a name, a member, a template, a concatenation and a string literal pass, and an `export { x }` of a name declared elsewhere is not judged.

## Related

- [Architecture § The agent convention](../concepts/architecture.md#the-agent-convention): the layout the rules hold.
- [Develop § A lint rule](../guides/develop.md#a-lint-rule): the pieces a new rule moves with.
