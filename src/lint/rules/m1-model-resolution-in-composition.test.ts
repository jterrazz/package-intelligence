import { RuleTester } from 'oxlint/plugins-dev';
import { describe, it } from 'vitest';

import { m1ModelResolutionInComposition } from './m1-model-resolution-in-composition.js';

RuleTester.describe = describe;
RuleTester.it = it;

type OxlintRule = Parameters<RuleTester['run']>[1];

const ruleTester = new RuleTester();

const OUTSIDE = '/repo/src/wiring/setup.ts';
const COMPOSITION_FILE = '/repo/src/composition/providers.ts';
const FORMER_DI_FILE = '/repo/src/di/container.ts';
const FORMER_CONTAINER = '/repo/src/infrastructure/intelligence-container.ts';

ruleTester.run(
    'm1-model-resolution-in-composition',
    m1ModelResolutionInComposition as unknown as OxlintRule,
    {
        invalid: [
            {
                code: "import { createIntelligence } from '@jterrazz/intelligence';\nconst i = createIntelligence({});",
                errors: [{ messageId: 'factoryOutsideComposition' }],
                filename: FORMER_DI_FILE,
                name: 'a file under di/, the former container folder',
            },
            {
                code: "import { createIntelligence } from '@jterrazz/intelligence';\nconst i = createIntelligence({});",
                errors: [{ messageId: 'factoryOutsideComposition' }],
                filename: FORMER_CONTAINER,
                name: 'a file named *container.ts, the former container file',
            },
            {
                code: "import { createIntelligence } from '@jterrazz/intelligence';\nconst i = createIntelligence({});",
                errors: [{ messageId: 'factoryOutsideComposition' }],
                filename: OUTSIDE,
                name: 'createIntelligence outside the composition root',
            },
            {
                code: "import { createGatewayProvider } from '@jterrazz/intelligence';\nconst p = createGatewayProvider({});",
                errors: [{ messageId: 'factoryOutsideComposition' }],
                filename: OUTSIDE,
                name: 'createGatewayProvider outside the composition root',
            },
            {
                code: "import { createIntelligence } from '@jterrazz/intelligence';\nconst i = createIntelligence({});\nconst m = i.model('summarizer');",
                errors: [
                    { messageId: 'factoryOutsideComposition' },
                    { messageId: 'modelCallOutsideComposition' },
                ],
                filename: OUTSIDE,
                name: 'a literal model call outside the composition root',
            },
        ],
        valid: [
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
    },
);
