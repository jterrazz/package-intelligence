import { ruleTester } from '@jterrazz/test';

import { noHardcodedModelId } from '../no-hardcoded-model-id.js';

const SOURCE_FILE = '/repo/src/infrastructure/outbound/providers/model-choice.ts';

ruleTester().run('no-hardcoded-model-id', noHardcodedModelId, {
    invalid: [
        {
            code: "const m = 'gpt-4o';",
            errors: [{ column: 10, line: 1, messageId: 'hardcodedModelId' }],
            filename: '/repo/src/models.config.tsv.ts',
            name: 'a file whose name holds `.config.` but is no config',
        },
        {
            code: "const m = 'gpt4o';",
            errors: [{ column: 10, line: 1, messageId: 'hardcodedModelId' }],
            filename: SOURCE_FILE,
            name: 'a model id whose family runs straight into a digit',
        },
        {
            code: "const m = '01-ai/llama-3';",
            errors: [{ column: 10, line: 1, messageId: 'hardcodedModelId' }],
            filename: SOURCE_FILE,
            name: 'a provider prefix holding a digit',
        },
        {
            code: "const m = 'gpt-4o';",
            errors: [{ column: 10, line: 1, messageId: 'hardcodedModelId' }],
            filename: '/repo/src/models/a.test.tsv.ts',
            name: 'a file whose name holds `.test.` but is no test',
        },
        {
            code: "export const DEFAULT_MODEL = 'claude-3-5-sonnet-20241022';",
            errors: [{ column: 29, line: 1, messageId: 'hardcodedModelId' }],
            filename: SOURCE_FILE,
            name: 'a bare Anthropic model id',
        },
        {
            code: "const m = 'gpt-4o-mini';",
            errors: [{ column: 10, line: 1, messageId: 'hardcodedModelId' }],
            filename: SOURCE_FILE,
            name: 'a bare OpenAI model id',
        },
        {
            code: "const m = 'o1-preview';",
            errors: [{ column: 10, line: 1, messageId: 'hardcodedModelId' }],
            filename: SOURCE_FILE,
            name: 'an o1-style model id',
        },
        {
            code: "const m = 'openai/gpt-4o-mini';",
            errors: [{ column: 10, line: 1, messageId: 'hardcodedModelId' }],
            filename: SOURCE_FILE,
            name: 'a provider-prefixed model id',
        },
    ],
    valid: [
        {
            code: "const m = 'gpt-4o';",
            filename: '/repo/src/models.config.mts',
            name: 'a model id in an ES module config file',
        },
        {
            code: "const tool = 'chatgpt-like';",
            filename: SOURCE_FILE,
            name: 'a word that only holds a family name',
        },
        {
            code: "const path = 'see docs/claude';",
            filename: SOURCE_FILE,
            name: 'a path that only holds a prefixed family',
        },
        {
            code: 'const m = 4;',
            filename: SOURCE_FILE,
            name: 'a number',
        },
        {
            code: "const m = 'claude-3-5-sonnet';",
            filename: '/repo/src/config/models.ts',
            name: 'a model id under config/',
        },
        {
            code: "const m = 'claude-3-5-sonnet';",
            filename: '/repo/specs/integration/agents/models.ts',
            name: 'a model id under specs/',
        },
        {
            code: "const m = 'claude-3-5-sonnet';",
            filename: '/repo/src/agents/__fixtures__/models.ts',
            name: 'a model id under __fixtures__/',
        },
        {
            code: "const m = 'claude-3-5-sonnet';",
            filename: '/repo/src/agents/models.spec.mts',
            name: 'a model id in a spec of another module kind',
        },
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
