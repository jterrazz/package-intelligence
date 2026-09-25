import { RuleTester } from 'oxlint/plugins-dev';
import { describe, it } from 'vitest';

import { p1ProseInPromptFiles } from './p1-prose-in-prompt-files.js';

RuleTester.describe = describe;
RuleTester.it = it;

type OxlintRule = Parameters<RuleTester['run']>[1];

const ruleTester = new RuleTester();

const AGENT_FILE = '/repo/src/infrastructure/outbound/agents/article-composer/article-composer.ts';
const AGENT_HELPER = '/repo/src/infrastructure/outbound/agents/article-composer/helpers.ts';
const PROMPT_FILE =
    '/repo/src/infrastructure/outbound/agents/article-composer/article-composer.prompt.ts';
const TEST_FILE =
    '/repo/src/infrastructure/outbound/agents/article-composer/article-composer.test.ts';
const OUTSIDE_AGENTS = '/repo/src/domain/news/article.ts';

ruleTester.run('p1-prose-in-prompt-files', p1ProseInPromptFiles as unknown as OxlintRule, {
    invalid: [
        {
            code: 'const prompt = `You are a careful assistant.\nWrite a concise summary of the article.\nUse neutral language throughout.`;',
            errors: [{ messageId: 'moveProse' }],
            filename: AGENT_FILE,
            name: 'multi-line prose in the agent file',
        },
        {
            code: 'const prompt = `# Article\n## Rules\nGo.`;',
            errors: [{ messageId: 'moveProse' }],
            filename: AGENT_FILE,
            name: 'a markdown heading',
        },
        {
            code: 'const text = `This is a fairly long instruction\nspanning several lines of natural language\nfor the model to follow.`;',
            errors: [{ messageId: 'moveProse' }],
            filename: AGENT_HELPER,
            name: 'prose in a helper under agents/',
        },
        {
            // oxlint-disable-next-line no-template-curly-in-string -- literal TS source fixture (the rule under test parses this), not an interpolation typo
            code: 'const prompt = `Summarize this article about ${topic}.\nFocus on the key facts and events.\nKeep it neutral and factual.`;',
            errors: [{ messageId: 'moveProse' }],
            filename: AGENT_FILE,
            name: 'prose around an interpolation',
        },
    ],
    valid: [
        {
            code: 'const prompt = `You are a careful assistant.\nWrite a concise summary of the article.\nUse neutral language throughout.`;',
            filename: OUTSIDE_AGENTS,
            name: 'prose outside agents/',
        },
        {
            code: 'export const buildPrompt = () => `You are a careful assistant.\nWrite a concise summary of the article.\nUse neutral language throughout.`;',
            filename: PROMPT_FILE,
            name: 'prose in a prompt file',
        },
        {
            code: 'const prompt = `You are a careful assistant.\nWrite a concise summary of the article.\nUse neutral language throughout.`;',
            filename: TEST_FILE,
            name: 'prose in a test file under agents/',
        },
        {
            // oxlint-disable-next-line no-template-curly-in-string -- literal TS source fixture (the rule under test parses this), not an interpolation typo
            code: 'const label = `Composing article for ${eventId}`;',
            filename: AGENT_FILE,
            name: 'a single-line literal',
        },
        {
            // oxlint-disable-next-line no-template-curly-in-string -- literal TS source fixture (the rule under test parses this), not an interpolation typo
            code: 'const json = `{\n  "id": ${id},\n  "ok": true\n}`;',
            filename: AGENT_FILE,
            name: 'multi-line data that is not prose',
        },
    ],
});
