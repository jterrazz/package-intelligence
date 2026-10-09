import { ruleTester } from '@jterrazz/test';

import { modelResolutionInComposition } from '../model-resolution-in-composition.js';

const OUTSIDE = '/repo/src/wiring/setup.ts';
const COMPOSITION_FILE = '/repo/src/composition/providers.ts';
const FORMER_DI_FILE = '/repo/src/di/container.ts';
const FORMER_CONTAINER = '/repo/src/infrastructure/intelligence-container.ts';

ruleTester().run('model-resolution-in-composition', modelResolutionInComposition, {
    invalid: [
        {
            code: "import { createIntelligence } from '@jterrazz/intelligence';\nconst m = i.model(`summarizer`);",
            errors: [{ column: 10, line: 2, messageId: 'modelCallOutsideComposition' }],
            filename: OUTSIDE,
            name: 'a model named by a template with no expression',
        },
        {
            code: 'const p = createOpenRouterProvider({});',
            errors: [
                {
                    column: 10,
                    line: 1,
                    messageId: 'factoryOutsideComposition',
                    data: { name: 'createOpenRouterProvider' },
                },
            ],
            filename: OUTSIDE,
            name: 'createOpenRouterProvider outside the composition root, imported or not',
        },
        {
            code: "import { createIntelligence } from '@jterrazz/intelligence';\nconst i = createIntelligence({});",
            errors: [{ column: 10, line: 2, messageId: 'factoryOutsideComposition' }],
            filename: FORMER_DI_FILE,
            name: 'a file under di/, the former container folder',
        },
        {
            code: "import { createIntelligence } from '@jterrazz/intelligence';\nconst i = createIntelligence({});",
            errors: [{ column: 10, line: 2, messageId: 'factoryOutsideComposition' }],
            filename: FORMER_CONTAINER,
            name: 'a file named *container.ts, the former container file',
        },
        {
            code: "import { createIntelligence } from '@jterrazz/intelligence';\nconst i = createIntelligence({});",
            errors: [{ column: 10, line: 2, messageId: 'factoryOutsideComposition' }],
            filename: OUTSIDE,
            name: 'createIntelligence outside the composition root',
        },
        {
            code: "import { createGatewayProvider } from '@jterrazz/intelligence';\nconst p = createGatewayProvider({});",
            errors: [{ column: 10, line: 2, messageId: 'factoryOutsideComposition' }],
            filename: OUTSIDE,
            name: 'createGatewayProvider outside the composition root',
        },
        {
            code: "import { createIntelligence } from '@jterrazz/intelligence';\nconst i = createIntelligence({});\nconst m = i.model('summarizer');",
            errors: [
                { column: 10, line: 2, messageId: 'factoryOutsideComposition' },
                { column: 10, line: 3, messageId: 'modelCallOutsideComposition' },
            ],
            filename: OUTSIDE,
            name: 'a literal model call outside the composition root',
        },
    ],
    valid: [
        {
            code: "import { createIntelligence } from '@jterrazz/intelligence';\nconst m = i.model(42);",
            filename: OUTSIDE,
            name: 'a model named by a number',
        },
        {
            code: "import { createIntelligence } from '@jterrazz/intelligence';\nconst m = i[model]('summarizer');",
            filename: OUTSIDE,
            name: 'a member computed from a name',
        },
        {
            code: "import { createIntelligence } from '@jterrazz/intelligence';\nclass A { #model(name) { return name; } run() { return this.#model('summarizer'); } }",
            filename: OUTSIDE,
            name: 'a private method named model',
        },
        {
            code: "import { createIntelligence } from '@jterrazz/intelligence';\nconst m = i.model(`${name}`);",
            filename: OUTSIDE,
            name: 'a model named by a template with an expression',
        },
        {
            code: "import { createIntelligence } from '@jterrazz/intelligence';\nconst m = i['model']('summarizer');",
            filename: OUTSIDE,
            name: 'a computed model member',
        },
        {
            code: "import { createIntelligence } from '@jterrazz/intelligence';\nconst m = i.model('summarizer', options);",
            filename: OUTSIDE,
            name: 'a model call with two arguments',
        },
        {
            code: "import { createIntelligence } from '@jterrazz/intelligence';\nconst m = i.build('summarizer');",
            filename: OUTSIDE,
            name: 'a literal call on another member',
        },
        {
            code: "import { model } from '@jterrazz/other';\nconst m = client.model('gpt');",
            filename: OUTSIDE,
            name: 'a model call in a file importing another package',
        },
        {
            code: 'const i = sdk.createIntelligence({});',
            filename: OUTSIDE,
            name: 'a factory name read as a member of another object',
        },
        {
            code: "import { createIntelligence } from '@jterrazz/intelligence';\nconst i = createIntelligence({});\nconst m = i.model('summarizer');",
            filename: '/repo/specs/integration/agents/summarizer.spec.ts',
            name: 'a spec composing its own subject',
        },
        {
            code: "import { createIntelligence } from '@jterrazz/intelligence';\nconst i = createIntelligence({});",
            filename: '/repo/src/wiring/__tests__/setup.test.ts',
            name: 'a module test composing its own subject',
        },
        {
            code: "import { createIntelligence } from '@jterrazz/intelligence';\nconst i = createIntelligence({});\nconst m = i.model('summarizer');",
            filename: COMPOSITION_FILE,
            name: 'a file of the composition root',
        },
        {
            code: "const m = someOtherClient.model('gpt-4');",
            filename: OUTSIDE,
            name: 'a model call in a file that never imports the package',
        },
        {
            code: "import type { Intelligence } from '@jterrazz/intelligence';\nfunction wire(i: Intelligence, agentName: string) { return i.model(agentName); }",
            filename: OUTSIDE,
            name: 'a model call with a non-literal argument',
        },
    ],
});
