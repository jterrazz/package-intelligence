import { resolve } from 'node:path';
import { RuleTester } from 'oxlint/plugins-dev';
import { describe, it } from 'vitest';

import { p3AgentPromptSibling } from './p3-agent-prompt-sibling.js';

RuleTester.describe = describe;
RuleTester.it = it;

type OxlintRule = Parameters<RuleTester['run']>[1];

const ruleTester = new RuleTester();

// The sibling check reads the disk, so its cases point at real fixture files.
const FIXTURES = resolve(import.meta.dirname, '../../../specs/integration/lint/_fixtures');
const ORPHAN_PROMPT = `${FIXTURES}/p3-agent-prompt-sibling/src/infrastructure/outbound/agents/orphan-prompt/orphan-prompt.prompt.ts`;
const PAIRED_PROMPT = `${FIXTURES}/g1-agent-class-shape-ok/src/infrastructure/outbound/agents/good-agent/good-agent.prompt.ts`;

const AGENT_FILE = '/repo/src/infrastructure/outbound/agents/article-composer/article-composer.ts';

ruleTester.run('p3-agent-prompt-sibling', p3AgentPromptSibling as unknown as OxlintRule, {
    invalid: [
        {
            code: 'export class ArticleComposer { run() {} }',
            errors: [{ messageId: 'missingPromptImport' }],
            filename: AGENT_FILE,
            name: 'an agent file without its prompt import',
        },
        {
            code: "import { buildPrompt } from './prompt.js';\nexport class ArticleComposer { run() { return buildPrompt(); } }",
            errors: [{ messageId: 'missingPromptImport' }],
            filename: AGENT_FILE,
            name: 'an agent file importing the wrong prompt',
        },
        {
            code: 'export const buildPrompt = (): string => `Hello.`;',
            errors: [{ messageId: 'missingAgentSibling' }],
            filename: ORPHAN_PROMPT,
            name: 'a prompt file without a sibling agent',
        },
    ],
    valid: [
        {
            code: "import { buildPrompt } from './article-composer.prompt.js';\nexport class ArticleComposer { run() { return buildPrompt(); } }",
            filename: AGENT_FILE,
            name: 'an agent file importing its prompt',
        },
        {
            code: 'export const buildPrompt = (): string => `Hello.`;',
            filename: PAIRED_PROMPT,
            name: 'a prompt file with its sibling agent',
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
