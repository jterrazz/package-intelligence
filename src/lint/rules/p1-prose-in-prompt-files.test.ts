import { RuleTester } from 'oxlint/plugins-dev';
import { describe, it } from 'vitest';

import { p1ProseInPromptFiles } from './p1-prose-in-prompt-files.js';

RuleTester.describe = describe;
RuleTester.it = it;

// Boundary cast: oxlint does not export its `Rule` type, and our structural
// `LintRule` is intentionally decoupled from its internal (alpha) typings.
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
        // Multi-line prose (a real sentence) leaking into the agent file itself.
        {
            code: 'const prompt = `You are a careful assistant.\nWrite a concise summary of the article.\nUse neutral language throughout.`;',
            errors: [{ messageId: 'moveProse' }],
            filename: AGENT_FILE,
        },
        // A markdown heading is prose even without a 4-word line.
        {
            code: 'const prompt = `# Article\n## Rules\nGo.`;',
            errors: [{ messageId: 'moveProse' }],
            filename: AGENT_FILE,
        },
        // P1's scope is any non-prompt/non-test file under agents/, not just <name>.ts.
        {
            code: 'const text = `This is a fairly long instruction\nspanning several lines of natural language\nfor the model to follow.`;',
            errors: [{ messageId: 'moveProse' }],
            filename: AGENT_HELPER,
        },
        // Interpolated data inside a multi-line prose literal still counts (the
        // Static quasis carry the prose; the hole is just a value).
        {
            // eslint-disable-next-line no-template-curly-in-string -- literal TS source fixture (the rule under test parses this), not an interpolation typo
            code: 'const prompt = `Summarize this article about ${topic}.\nFocus on the key facts and events.\nKeep it neutral and factual.`;',
            errors: [{ messageId: 'moveProse' }],
            filename: AGENT_FILE,
        },
    ],
    valid: [
        // Outside any agents/ folder entirely — rule inert.
        {
            code: 'const prompt = `You are a careful assistant.\nWrite a concise summary of the article.\nUse neutral language throughout.`;',
            filename: OUTSIDE_AGENTS,
        },
        // *.prompt.ts is the rule's own escape hatch — inert there.
        {
            code: 'export const buildPrompt = () => `You are a careful assistant.\nWrite a concise summary of the article.\nUse neutral language throughout.`;',
            filename: PROMPT_FILE,
        },
        // *.test.ts under agents/ is exempt too.
        {
            code: 'const prompt = `You are a careful assistant.\nWrite a concise summary of the article.\nUse neutral language throughout.`;',
            filename: TEST_FILE,
        },
        // Single-line literal — never reaches the 3-line threshold.
        {
            // eslint-disable-next-line no-template-curly-in-string -- literal TS source fixture (the rule under test parses this), not an interpolation typo
            code: 'const label = `Composing article for ${eventId}`;',
            filename: AGENT_FILE,
        },
        // Multi-line but not prose (JSON-ish data interpolation, short lines).
        {
            // eslint-disable-next-line no-template-curly-in-string -- literal TS source fixture (the rule under test parses this), not an interpolation typo
            code: 'const json = `{\n  "id": ${id},\n  "ok": true\n}`;',
            filename: AGENT_FILE,
        },
    ],
});
