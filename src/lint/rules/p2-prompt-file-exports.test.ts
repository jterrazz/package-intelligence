import { RuleTester } from 'oxlint/plugins-dev';
import { describe, it } from 'vitest';

import { p2PromptFileExports } from './p2-prompt-file-exports.js';

RuleTester.describe = describe;
RuleTester.it = it;

type OxlintRule = Parameters<RuleTester['run']>[1];

const ruleTester = new RuleTester();

const PROMPT_FILE =
    '/repo/src/infrastructure/outbound/agents/article-composer/article-composer.prompt.ts';
const AGENT_FILE = '/repo/src/infrastructure/outbound/agents/article-composer/article-composer.ts';

ruleTester.run('p2-prompt-file-exports', p2PromptFileExports as unknown as OxlintRule, {
    invalid: [
        {
            // oxlint-disable-next-line no-template-curly-in-string -- literal TS source fixture (the rule under test parses this), not an interpolation typo
            code: 'export default (v: string) => `Hello ${v}`;',
            errors: [{ messageId: 'defaultExport' }],
            filename: PROMPT_FILE,
            name: 'a default export',
        },
        {
            code: 'export class PromptBuilder { build() { return "x"; } }',
            errors: [{ messageId: 'classExport' }],
            filename: PROMPT_FILE,
            name: 'a class export',
        },
        {
            code: 'export const MAX_LENGTH = 500;',
            errors: [{ messageId: 'nonFunctionExport' }],
            filename: PROMPT_FILE,
            name: 'a non-function const',
        },
        {
            // oxlint-disable-next-line no-template-curly-in-string -- literal TS source fixture (the rule under test parses this), not an interpolation typo
            code: 'export function buildPrompt(v: string): string { return `Hello ${v}`; }',
            errors: [{ messageId: 'nonFunctionExport' }],
            filename: PROMPT_FILE,
            name: 'a function declaration',
        },
        {
            code: 'export const buildPrompt = (v: string) => ({ text: v });',
            errors: [{ messageId: 'nonStringReturn' }],
            filename: PROMPT_FILE,
            name: 'an arrow returning an object',
        },
        {
            // oxlint-disable-next-line no-template-curly-in-string -- literal TS source fixture (the rule under test parses this), not an interpolation typo
            code: 'export const buildPrompt = (v: string) => { if (!v) return []; return `Hello ${v}`; };',
            errors: [{ messageId: 'nonStringReturn' }],
            filename: PROMPT_FILE,
            name: 'a block body mixing a non-string return',
        },
    ],
    valid: [
        {
            // oxlint-disable-next-line no-template-curly-in-string -- literal TS source fixture (the rule under test parses this), not an interpolation typo
            code: 'export const buildPrompt = (v: string): string => `Hello ${v}`;',
            filename: PROMPT_FILE,
            name: 'the canonical builder',
        },
        {
            // oxlint-disable-next-line no-template-curly-in-string -- literal TS source fixture (the rule under test parses this), not an interpolation typo
            code: "export const buildSection = (items: string[]): string => { if (items.length === 0) { return ''; } return `Items: ${items.join(', ')}`; };",
            filename: PROMPT_FILE,
            name: 'an early-return builder',
        },
        {
            code: 'export const categoryTaxonomy = (): string => { return getCategoryTaxonomyPrompt(); };',
            filename: PROMPT_FILE,
            name: 'a builder delegating to another',
        },
        {
            // oxlint-disable-next-line no-template-curly-in-string -- literal TS source fixture (the rule under test parses this), not an interpolation typo
            code: 'export interface Variables { word: string; }\nexport type Lang = "EN" | "FR";\nexport const buildPrompt = (v: Variables): string => `Word: ${v.word}`;',
            filename: PROMPT_FILE,
            name: 'types and interfaces',
        },
        {
            code: 'export default class Foo {}',
            filename: AGENT_FILE,
            name: 'a file that is not a prompt file',
        },
    ],
});
