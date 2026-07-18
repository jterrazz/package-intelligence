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
        // A bare Anthropic model id.
        {
            code: "export const DEFAULT_MODEL = 'claude-3-5-sonnet-20241022';",
            errors: [{ messageId: 'hardcodedModelId' }],
            filename: SOURCE_FILE,
        },
        // A bare OpenAI model id.
        {
            code: "const m = 'gpt-4o-mini';",
            errors: [{ messageId: 'hardcodedModelId' }],
            filename: SOURCE_FILE,
        },
        // An "o1"-style reasoning model id.
        {
            code: "const m = 'o1-preview';",
            errors: [{ messageId: 'hardcodedModelId' }],
            filename: SOURCE_FILE,
        },
        // Provider-prefixed form (openrouter-style `<provider>/<model>`).
        {
            code: "const m = 'openai/gpt-4o-mini';",
            errors: [{ messageId: 'hardcodedModelId' }],
            filename: SOURCE_FILE,
        },
    ],
    valid: [
        // A plain string unrelated to model ids.
        {
            code: "const label = 'summarizer';",
            filename: SOURCE_FILE,
        },
        // The same literal, but in a *.test.ts file — exempt.
        {
            code: "const m = 'claude-3-5-sonnet-20241022';",
            filename: '/repo/src/infrastructure/outbound/providers/model-choice.test.ts',
        },
        // Under a fixtures/ directory — exempt.
        {
            code: "const m = 'claude-3-5-sonnet-20241022';",
            filename: '/repo/tests/fixtures/model-choice.ts',
        },
        // A *.config.ts file — exempt.
        {
            code: "const m = 'claude-3-5-sonnet-20241022';",
            filename: '/repo/src/intelligence.config.ts',
        },
    ],
});
