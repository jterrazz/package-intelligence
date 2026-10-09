import { ruleTester } from '@jterrazz/test';

import { proseInPromptFiles } from '../prose-in-prompt-files.js';

const AGENT_FILE = '/repo/src/infrastructure/outbound/agents/article-composer/article-composer.ts';
const AGENT_HELPER = '/repo/src/infrastructure/outbound/agents/article-composer/helpers.ts';
const PROMPT_FILE =
    '/repo/src/infrastructure/outbound/agents/article-composer/article-composer.prompt.ts';
const TEST_FILE =
    '/repo/src/infrastructure/outbound/agents/article-composer/article-composer.test.ts';
const OUTSIDE_AGENTS = '/repo/src/domain/news/article.ts';

ruleTester().run('prose-in-prompt-files', proseInPromptFiles, {
    invalid: [
        {
            code: 'const prompt = `## Rules\n### Steps\nGo.`;',
            errors: [
                {
                    column: 15,
                    line: 1,
                    messageId: 'moveProse',
                    data: { target: 'article-composer.prompt.ts' },
                },
            ],
            filename: AGENT_FILE,
            name: 'second- and third-level headings',
        },
        {
            code: 'const prompt = `  ## Rules\nA\nB`;',
            errors: [{ column: 15, line: 1, messageId: 'moveProse' }],
            filename: AGENT_FILE,
            name: 'an indented heading',
        },
        {
            code: 'const prompt = `one two three four\nx\ny`;',
            errors: [{ column: 15, line: 1, messageId: 'moveProse' }],
            filename: AGENT_FILE,
            name: 'a line of four words',
        },
        {
            code: 'const prompt = `${a}\nshort\n${b} — and then a whole sentence of prose`;',
            errors: [{ column: 15, line: 1, messageId: 'moveProse' }],
            filename: AGENT_FILE,
            name: 'prose in one piece of an interpolated literal',
        },
        {
            code: 'const prompt = `Write a careful summary\nof the article\nnow`;',
            errors: [
                {
                    column: 15,
                    line: 1,
                    messageId: 'moveProse',
                    data: { target: 'data.tsv-reader.prompt.ts' },
                },
            ],
            filename:
                '/repo/src/infrastructure/outbound/agents/article-composer/data.tsv-reader.ts',
            name: 'a module whose name holds .ts',
        },
        {
            code: 'const prompt = `You are a careful assistant.\nWrite a concise summary of the article.\nUse neutral language throughout.`;',
            errors: [{ column: 15, line: 1, messageId: 'moveProse' }],
            filename: AGENT_FILE,
            name: 'multi-line prose in the agent file',
        },
        {
            code: 'const prompt = `# Article\n## Rules\nGo.`;',
            errors: [{ column: 15, line: 1, messageId: 'moveProse' }],
            filename: AGENT_FILE,
            name: 'a markdown heading',
        },
        {
            code: 'const text = `This is a fairly long instruction\nspanning several lines of natural language\nfor the model to follow.`;',
            errors: [{ column: 13, line: 1, messageId: 'moveProse' }],
            filename: AGENT_HELPER,
            name: 'prose in a helper under agents/',
        },
        {
            code: 'const prompt = `Summarize this article about ${topic}.\nFocus on the key facts and events.\nKeep it neutral and factual.`;',
            errors: [{ column: 15, line: 1, messageId: 'moveProse' }],
            filename: AGENT_FILE,
            name: 'prose around an interpolation',
        },
    ],
    valid: [
        {
            code: 'const prompt = `one  two  three\nx\ny`;',
            filename: AGENT_FILE,
            name: 'three words spread by double spaces',
        },
        {
            code: 'const a = 1;\nconst b = 2;\nconst prompt = `You are a careful assistant writing`;',
            filename: AGENT_FILE,
            name: 'prose on one line of a longer file',
        },
        {
            code: 'const prompt = `one two three\nx\ny`;',
            filename: AGENT_FILE,
            name: 'lines of three words',
        },
        {
            code: 'const prompt = `#one\n#two\n#three`;',
            filename: AGENT_FILE,
            name: 'hash words that are no heading',
        },
        {
            code: 'const prompt = `a # b\nc\nd`;',
            filename: AGENT_FILE,
            name: 'a hash inside a line',
        },
        {
            code: 'const prompt = `#### Deep\nx\ny`;',
            filename: AGENT_FILE,
            name: 'a fourth-level heading',
        },
        {
            code: 'const prompt = `A careful summary of the article\nnow`;',
            filename: AGENT_FILE,
            name: 'prose on two lines',
        },
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
            code: 'const label = `Composing article for ${eventId}`;',
            filename: AGENT_FILE,
            name: 'a single-line literal',
        },
        {
            code: 'const json = `{\n  "id": ${id},\n  "ok": true\n}`;',
            filename: AGENT_FILE,
            name: 'multi-line data that is not prose',
        },
    ],
});
