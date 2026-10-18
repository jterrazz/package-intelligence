import { byName } from '@jterrazz/typescript/rules';
import type { RuleDocs } from '@jterrazz/typescript/rules';

import type { Family } from './families.js';

export type Row = RuleDocs & { audience: 'consumer'; family: Family; why: string };

export const consumerRows: readonly Row[] = byName<Row>([
    {
        audience: 'consumer',
        family: 'agents',
        fix: 'export one class from the agent file, with a `static readonly SCHEMA`, a `run` method and a constructor whose first parameter is `model`',
        name: 'agent-class-shape',
        sentence:
            'An agent file (`agents/<name>/<name>.ts`) exports exactly one class; that class has a `static readonly SCHEMA` member, a `run` method, and a constructor whose first parameter is named `model`.',
        why: 'A fixed shape makes every agent class predictable to read and to wire from the composition root without re-deriving its contract each time.',
    },
    {
        audience: 'consumer',
        family: 'agents',
        fix: 'import the prompt from `./<name>.prompt.js` in the agent file, or give the prompt file its agent `<name>.ts` beside it',
        name: 'agent-prompt-sibling',
        sentence:
            'An agent file (`agents/<name>/<name>.ts`) imports its prompt from `./<name>.prompt.js`; a `<name>.prompt.ts` outside a `_<subject>/` folder has its agent `<name>.ts` in the same folder.',
        why: 'The two-way link makes the pairing mechanical: an orphaned prompt, or an agent that does not use its prompt, is almost always a mistake.',
    },
    {
        audience: 'consumer',
        family: 'models',
        fix: 'call the factory, and resolve the model by name, in a file under `composition/`, and hand the model to what needs it',
        name: 'model-resolution-in-composition',
        sentence:
            "`createIntelligence(...)`, `createGatewayProvider(...)` and `createOpenRouterProvider(...)` imported from `@jterrazz/intelligence`, and `.model('...')` with a literal name in a file importing it, are called only from the composition root, a file under `composition/`, or from a test, which composes its own subject.",
        why: "Model resolution is the composition root's work: scattered, a provider or model choice drifts outside the one place meant to own it.",
    },
    {
        audience: 'consumer',
        family: 'models',
        fix: 'read the model id from configuration (the composition root names it) and keep the literal out of the code',
        name: 'no-hardcoded-model-id',
        sentence:
            'A string literal that reads as a model id (`claude-...`, `openai/gpt-...` and the like) sits only in a config, test, fixture or spec file.',
        why: 'A model id written in application code changes only with a deploy; in configuration it changes without one.',
    },
    {
        audience: 'consumer',
        family: 'prompts',
        fix: 'move the prose into the sibling `*.prompt.ts`, as a function returning the string',
        name: 'prose-in-prompt-files',
        sentence:
            'Under an `agents/` folder, a file that is not a `*.prompt.ts` nor a `*.test.ts` holds no template literal of three lines or more that reads as prose: a line of four words or more, or a markdown heading.',
        why: 'The agent class only shapes data: prose that leaks into it hides the prompt contract, and the two can no longer be reviewed apart.',
    },
    {
        audience: 'consumer',
        family: 'prompts',
        fix: 'export only `const` arrow functions returning a string, and types',
        name: 'prompt-file-exports',
        sentence:
            'A `*.prompt.ts` file exports only `const` arrow functions returning a string, and types: no default export, no class, no other value.',
        why: 'A closed export surface keeps a prompt file a pure builder: state, a class or a default export would invite prompt logic to grow side effects.',
    },
]);
