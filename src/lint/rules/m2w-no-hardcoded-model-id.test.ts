import { RuleTester } from 'oxlint/plugins-dev';
import { describe, it } from 'vitest';

import { m2wNoHardcodedModelId } from './m2w-no-hardcoded-model-id.js';

RuleTester.describe = describe;
RuleTester.it = it;

type OxlintRule = Parameters<RuleTester['run']>[1];

const ruleTester = new RuleTester();

const SOURCE_FILE = '/repo/src/infrastructure/outbound/providers/model-choice.ts';

ruleTester.run('m2w-no-hardcoded-model-id', m2wNoHardcodedModelId as unknown as OxlintRule, {
    invalid: [
        {
            code: "export const DEFAULT_MODEL = 'claude-3-5-sonnet-20241022';",
            errors: [{ messageId: 'hardcodedModelId' }],
            filename: SOURCE_FILE,
            name: 'a bare Anthropic model id',
        },
        {
            code: "const m = 'gpt-4o-mini';",
            errors: [{ messageId: 'hardcodedModelId' }],
            filename: SOURCE_FILE,
            name: 'a bare OpenAI model id',
        },
        {
            code: "const m = 'o1-preview';",
            errors: [{ messageId: 'hardcodedModelId' }],
            filename: SOURCE_FILE,
            name: 'an o1-style model id',
        },
        {
            code: "const m = 'openai/gpt-4o-mini';",
            errors: [{ messageId: 'hardcodedModelId' }],
            filename: SOURCE_FILE,
            name: 'a provider-prefixed model id',
        },
    ],
    valid: [
        {
            code: "const label = 'summarizer';",
            filename: SOURCE_FILE,
            name: 'a string unrelated to model ids',
        },
        {
            code: "const m = 'claude-3-5-sonnet-20241022';",
            filename: '/repo/src/infrastructure/outbound/providers/model-choice.test.ts',
            name: 'a model id in a test file',
        },
        {
            code: "const m = 'claude-3-5-sonnet-20241022';",
            filename: '/repo/tests/fixtures/model-choice.ts',
            name: 'a model id under fixtures/',
        },
        {
            code: "const m = 'claude-3-5-sonnet-20241022';",
            filename: '/repo/src/intelligence.config.ts',
            name: 'a model id in a config file',
        },
    ],
});
