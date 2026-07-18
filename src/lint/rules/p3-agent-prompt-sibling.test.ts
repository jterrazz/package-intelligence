import { resolve } from 'node:path';
import { RuleTester } from 'oxlint/plugins-dev';
import { describe, it } from 'vitest';

import { p3AgentPromptSibling } from './p3-agent-prompt-sibling.js';

RuleTester.describe = describe;
RuleTester.it = it;

type OxlintRule = Parameters<RuleTester['run']>[1];

const ruleTester = new RuleTester();

// P3's sibling check (b) is fs-anchored (`fs.existsSync`), so those cases point
// At REAL fixture files shipped in this repo — mirrors `@jterrazz/test`'s
// `c8-referenced-fixture-exists.test.ts`. Check (a) — the import-source check
// — is pure AST and needs no real file, so it uses synthetic filenames.
const FIXTURES = resolve(import.meta.dirname, '../../../tests/lint-fixtures/lint-violations');
const ORPHAN_PROMPT = `${FIXTURES}/p3-agent-prompt-sibling/src/infrastructure/outbound/agents/orphan-prompt/orphan-prompt.prompt.ts`;
const PAIRED_PROMPT = `${FIXTURES}/g1-agent-class-shape-ok/src/infrastructure/outbound/agents/good-agent/good-agent.prompt.ts`;

const AGENT_FILE = '/repo/src/infrastructure/outbound/agents/article-composer/article-composer.ts';

ruleTester.run('p3-agent-prompt-sibling', p3AgentPromptSibling as unknown as OxlintRule, {
    invalid: [
        // Agent file missing the `./<name>.prompt.js` import entirely.
        {
            code: 'export class ArticleComposer { run() {} }',
            errors: [{ messageId: 'missingPromptImport' }],
            filename: AGENT_FILE,
        },
        // Agent file importing the prompt from the wrong path/name.
        {
            code: "import { buildPrompt } from './prompt.js';\nexport class ArticleComposer { run() { return buildPrompt(); } }",
            errors: [{ messageId: 'missingPromptImport' }],
            filename: AGENT_FILE,
        },
        // Prompt file with no sibling agent file on disk.
        {
            code: 'export const buildPrompt = (): string => `Hello.`;',
            errors: [{ messageId: 'missingAgentSibling' }],
            filename: ORPHAN_PROMPT,
        },
    ],
    valid: [
        // Agent file importing its prompt correctly.
        {
            code: "import { buildPrompt } from './article-composer.prompt.js';\nexport class ArticleComposer { run() { return buildPrompt(); } }",
            filename: AGENT_FILE,
        },
        // Prompt file WITH a real sibling agent file on disk.
        {
            code: 'export const buildPrompt = (): string => `Hello.`;',
            filename: PAIRED_PROMPT,
        },
        // A `_shared/` prompt file is exempt from the sibling requirement.
        {
            code: 'export const categoryTaxonomy = (): string => `Taxonomy.`;',
            filename:
                '/repo/src/infrastructure/outbound/agents/_shared/category-taxonomy.prompt.ts',
        },
        // Neither an agent file nor a prompt file — rule inert.
        {
            code: 'export const helper = () => 1;',
            filename: '/repo/src/infrastructure/outbound/agents/article-composer/helpers.ts',
        },
    ],
});
