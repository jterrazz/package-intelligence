import { RuleTester } from 'oxlint/plugins-dev';
import { describe, it } from 'vitest';

import { m1ModelResolutionInContainer } from './m1-model-resolution-in-container.js';

RuleTester.describe = describe;
RuleTester.it = it;

type OxlintRule = Parameters<RuleTester['run']>[1];

const ruleTester = new RuleTester();

const OUTSIDE = '/repo/src/wiring/setup.ts';
const DI_FILE = '/repo/src/di/container.ts';
const NAMED_CONTAINER = '/repo/src/infrastructure/intelligence-container.ts';

ruleTester.run(
    'm1-model-resolution-in-container',
    m1ModelResolutionInContainer as unknown as OxlintRule,
    {
        invalid: [
            {
                code: "import { createIntelligence } from '@jterrazz/intelligence';\nconst i = createIntelligence({});",
                errors: [{ messageId: 'factoryOutsideContainer' }],
                filename: OUTSIDE,
                name: 'createIntelligence outside a container',
            },
            {
                code: "import { createGatewayProvider } from '@jterrazz/intelligence';\nconst p = createGatewayProvider({});",
                errors: [{ messageId: 'factoryOutsideContainer' }],
                filename: OUTSIDE,
                name: 'createGatewayProvider outside a container',
            },
            {
                code: "import { createIntelligence } from '@jterrazz/intelligence';\nconst i = createIntelligence({});\nconst m = i.model('summarizer');",
                errors: [
                    { messageId: 'factoryOutsideContainer' },
                    { messageId: 'modelCallOutsideContainer' },
                ],
                filename: OUTSIDE,
                name: 'a literal model call outside a container',
            },
        ],
        valid: [
            {
                code: "import { createIntelligence } from '@jterrazz/intelligence';\nconst i = createIntelligence({});\nconst m = i.model('summarizer');",
                filename: DI_FILE,
                name: 'a file under di/',
            },
            {
                code: "import { createIntelligence } from '@jterrazz/intelligence';\nconst i = createIntelligence({});\nconst m = i.model('summarizer');",
                filename: NAMED_CONTAINER,
                name: 'a file named *container.ts',
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
    },
);
