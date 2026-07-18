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
            // CreateIntelligence() called outside di/ and outside *container.ts.
            {
                code: "import { createIntelligence } from '@jterrazz/intelligence';\nconst i = createIntelligence({});",
                errors: [{ messageId: 'factoryOutsideContainer' }],
                filename: OUTSIDE,
            },
            // CreateGatewayProvider() outside the allow-listed locations.
            {
                code: "import { createGatewayProvider } from '@jterrazz/intelligence';\nconst p = createGatewayProvider({});",
                errors: [{ messageId: 'factoryOutsideContainer' }],
                filename: OUTSIDE,
            },
            // .model('…') called outside the allow-listed locations, file imports the package.
            {
                code: "import { createIntelligence } from '@jterrazz/intelligence';\nconst i = createIntelligence({});\nconst m = i.model('summarizer');",
                errors: [
                    { messageId: 'factoryOutsideContainer' },
                    { messageId: 'modelCallOutsideContainer' },
                ],
                filename: OUTSIDE,
            },
        ],
        valid: [
            // Allowed: a file under di/.
            {
                code: "import { createIntelligence } from '@jterrazz/intelligence';\nconst i = createIntelligence({});\nconst m = i.model('summarizer');",
                filename: DI_FILE,
            },
            // Allowed: a file named *container.ts (not necessarily under di/).
            {
                code: "import { createIntelligence } from '@jterrazz/intelligence';\nconst i = createIntelligence({});\nconst m = i.model('summarizer');",
                filename: NAMED_CONTAINER,
            },
            // .model('…') outside the allow-listed location, but the file never
            // Imports @jterrazz/intelligence — documented limitation: not tracked.
            {
                code: "const m = someOtherClient.model('gpt-4');",
                filename: OUTSIDE,
            },
            // .model() call with a non-literal argument is out of static reach
            // (the file imports the package but never calls a factory itself —
            // E.g. `i` arrives as an injected parameter, as in the README's
            // Container.ts example).
            {
                code: "import type { Intelligence } from '@jterrazz/intelligence';\nfunction wire(i: Intelligence, agentName: string) { return i.model(agentName); }",
                filename: OUTSIDE,
            },
        ],
    },
);
