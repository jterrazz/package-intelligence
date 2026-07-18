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
        // Default export.
        {
            // eslint-disable-next-line no-template-curly-in-string -- literal TS source fixture (the rule under test parses this), not an interpolation typo
            code: 'export default (v: string) => `Hello ${v}`;',
            errors: [{ messageId: 'defaultExport' }],
            filename: PROMPT_FILE,
        },
        // A class export.
        {
            code: 'export class PromptBuilder { build() { return "x"; } }',
            errors: [{ messageId: 'classExport' }],
            filename: PROMPT_FILE,
        },
        // A non-function const export.
        {
            code: 'export const MAX_LENGTH = 500;',
            errors: [{ messageId: 'nonFunctionExport' }],
            filename: PROMPT_FILE,
        },
        // A plain `function` declaration — the convention is arrow consts.
        {
            // eslint-disable-next-line no-template-curly-in-string -- literal TS source fixture (the rule under test parses this), not an interpolation typo
            code: 'export function buildPrompt(v: string): string { return `Hello ${v}`; }',
            errors: [{ messageId: 'nonFunctionExport' }],
            filename: PROMPT_FILE,
        },
        // An arrow function that clearly returns an object, not a string.
        {
            code: 'export const buildPrompt = (v: string) => ({ text: v });',
            errors: [{ messageId: 'nonStringReturn' }],
            filename: PROMPT_FILE,
        },
        // Block body with a non-string return mixed with a string one.
        {
            // eslint-disable-next-line no-template-curly-in-string -- literal TS source fixture (the rule under test parses this), not an interpolation typo
            code: 'export const buildPrompt = (v: string) => { if (!v) return []; return `Hello ${v}`; };',
            errors: [{ messageId: 'nonStringReturn' }],
            filename: PROMPT_FILE,
        },
    ],
    valid: [
        // The canonical shape: a template-literal-returning arrow const.
        {
            // eslint-disable-next-line no-template-curly-in-string -- literal TS source fixture (the rule under test parses this), not an interpolation typo
            code: 'export const buildPrompt = (v: string): string => `Hello ${v}`;',
            filename: PROMPT_FILE,
        },
        // A section builder with an early-return string plus a template-literal return.
        {
            // eslint-disable-next-line no-template-curly-in-string -- literal TS source fixture (the rule under test parses this), not an interpolation typo
            code: "export const buildSection = (items: string[]): string => { if (items.length === 0) { return ''; } return `Items: ${items.join(', ')}`; };",
            filename: PROMPT_FILE,
        },
        // Delegating to another builder (best-effort: a call is a plausible string).
        {
            code: 'export const categoryTaxonomy = (): string => { return getCategoryTaxonomyPrompt(); };',
            filename: PROMPT_FILE,
        },
        // Types and interfaces are always allowed.
        {
            // eslint-disable-next-line no-template-curly-in-string -- literal TS source fixture (the rule under test parses this), not an interpolation typo
            code: 'export interface Variables { word: string; }\nexport type Lang = "EN" | "FR";\nexport const buildPrompt = (v: Variables): string => `Word: ${v.word}`;',
            filename: PROMPT_FILE,
        },
        // Not a prompt file — rule inert regardless of shape.
        {
            code: 'export default class Foo {}',
            filename: AGENT_FILE,
        },
    ],
});
