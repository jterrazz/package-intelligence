import { ruleTester } from '@jterrazz/test';

import { agentPromptSibling } from '../agent-prompt-sibling.js';

const AGENT_FILE = '/repo/src/infrastructure/outbound/agents/article-composer/article-composer.ts';

ruleTester().run('agent-prompt-sibling', agentPromptSibling, {
    invalid: [
        {
            code: "export { buildPrompt } from './article-composer.prompt.js';\nexport class ArticleComposer { run() {} }",
            errors: [{ column: 0, line: 1, messageId: 'missingPromptImport' }],
            filename: AGENT_FILE,
            name: 'an agent re-exporting its prompt without importing it',
        },
        {
            code: 'export class ArticleComposer { run() {} }',
            errors: [{ column: 0, line: 1, messageId: 'missingPromptImport' }],
            filename: AGENT_FILE,
            name: 'an agent file without its prompt import',
        },
        {
            code: "import { buildPrompt } from './prompt.js';\nexport class ArticleComposer { run() { return buildPrompt(); } }",
            errors: [{ column: 0, line: 1, messageId: 'missingPromptImport' }],
            filename: AGENT_FILE,
            name: 'an agent file importing the wrong prompt',
        },
    ],
    valid: [
        {
            code: "import { buildPrompt } from './article-composer.prompt.js';\nexport class ArticleComposer { run() { return buildPrompt(); } }",
            filename: AGENT_FILE,
            name: 'an agent file importing its prompt',
        },
        {
            code: 'export const categoryTaxonomy = (): string => `Taxonomy.`;',
            filename:
                '/repo/src/infrastructure/outbound/agents/_shared/category-taxonomy.prompt.ts',
            name: 'a shared prompt file',
        },
        {
            code: 'export const helper = () => 1;',
            filename: '/repo/src/infrastructure/outbound/agents/article-composer/helpers.ts',
            name: 'neither an agent nor a prompt file',
        },
    ],
});
