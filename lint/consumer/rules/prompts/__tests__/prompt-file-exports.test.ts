import { ruleTester } from '@jterrazz/test';

import { promptFileExports } from '../prompt-file-exports.js';

const PROMPT_FILE =
    '/repo/src/infrastructure/outbound/agents/article-composer/article-composer.prompt.ts';
const AGENT_FILE = '/repo/src/infrastructure/outbound/agents/article-composer/article-composer.ts';

ruleTester().run('prompt-file-exports', promptFileExports, {
    invalid: [
        {
            code: 'export const build = () => { return; };',
            errors: [
                { column: 21, line: 1, messageId: 'nonStringReturn', data: { name: 'build' } },
            ],
            filename: PROMPT_FILE,
            name: 'a builder returning nothing',
        },
        {
            code: 'export let title;',
            errors: [
                { column: 11, line: 1, messageId: 'nonFunctionExport', data: { name: 'title' } },
            ],
            filename: PROMPT_FILE,
            name: 'a value declared without one',
        },
        {
            code: 'export const build = (a: string) => a - 1;',
            errors: [
                { column: 36, line: 1, messageId: 'nonStringReturn', data: { name: 'build' } },
            ],
            filename: PROMPT_FILE,
            name: 'a builder returning a subtraction',
        },
        {
            code: "export const build = (a: boolean) => (a ? 'x' : 1);",
            errors: [
                { column: 38, line: 1, messageId: 'nonStringReturn', data: { name: 'build' } },
            ],
            filename: PROMPT_FILE,
            name: 'a builder returning a number on one branch',
        },
        {
            code: 'export const build = (a?: string) => a || 1;',
            errors: [
                { column: 37, line: 1, messageId: 'nonStringReturn', data: { name: 'build' } },
            ],
            filename: PROMPT_FILE,
            name: 'a builder whose fallback is a number',
        },
        {
            code: 'export const build = () => { const inner = () => 1; };',
            errors: [
                { column: 21, line: 1, messageId: 'nonStringReturn', data: { name: 'build' } },
            ],
            filename: PROMPT_FILE,
            name: 'a builder that returns nothing of its own',
        },
        {
            code: "export let title = 'x';",
            errors: [
                { column: 11, line: 1, messageId: 'nonFunctionExport', data: { name: 'title' } },
            ],
            filename: PROMPT_FILE,
            name: 'a value exported by let',
        },
        {
            code: "export const [first] = ['x'];",
            errors: [{ column: 13, line: 1, messageId: 'nonFunctionExport', data: { name: '?' } }],
            filename: PROMPT_FILE,
            name: 'a destructured export',
        },
        {
            code: 'export enum Tone { Calm }',
            errors: [
                { column: 0, line: 1, messageId: 'nonFunctionExport', data: { name: 'Tone' } },
            ],
            filename: PROMPT_FILE,
            name: 'an enum',
        },
        {
            code: 'export default (v: string) => `Hello ${v}`;',
            errors: [{ column: 0, line: 1, messageId: 'defaultExport' }],
            filename: PROMPT_FILE,
            name: 'a default export',
        },
        {
            code: 'export class PromptBuilder { build() { return "x"; } }',
            errors: [{ column: 0, line: 1, messageId: 'classExport' }],
            filename: PROMPT_FILE,
            name: 'a class export',
        },
        {
            code: 'export const MAX_LENGTH = 500;',
            errors: [{ column: 13, line: 1, messageId: 'nonFunctionExport' }],
            filename: PROMPT_FILE,
            name: 'a non-function const',
        },
        {
            code: 'export function buildPrompt(v: string): string { return `Hello ${v}`; }',
            errors: [{ column: 0, line: 1, messageId: 'nonFunctionExport' }],
            filename: PROMPT_FILE,
            name: 'a function declaration',
        },
        {
            code: 'export const buildPrompt = (v: string) => ({ text: v });',
            errors: [{ column: 43, line: 1, messageId: 'nonStringReturn' }],
            filename: PROMPT_FILE,
            name: 'an arrow returning an object',
        },
        {
            code: 'export const buildPrompt = (v: string) => { if (!v) return []; return `Hello ${v}`; };',
            errors: [{ column: 59, line: 1, messageId: 'nonStringReturn' }],
            filename: PROMPT_FILE,
            name: 'a block body mixing a non-string return',
        },
    ],
    valid: [
        {
            code: 'export const build = () => { function pad() { return 1; } const twice = function () { return 2; }; const half = () => { return 3; }; return `${pad()}${twice()}${half()}`; };',
            filename: PROMPT_FILE,
            name: 'a builder whose inner functions return numbers',
        },
        {
            code: "import { tone } from './tone.js';\nconst local = 1;\nexport const build = () => tone;",
            filename: PROMPT_FILE,
            name: 'statements beside the exports',
        },
        {
            code: 'export const build = (a: string, b: string) => a + b;',
            filename: PROMPT_FILE,
            name: 'a builder concatenating',
        },
        {
            code: "export const build = (a: boolean) => (a ? 'x' : `y`);",
            filename: PROMPT_FILE,
            name: 'a builder choosing between two strings',
        },
        {
            code: "export const build = (a?: string) => a ?? 'none';",
            filename: PROMPT_FILE,
            name: 'a builder with a string fallback',
        },
        {
            code: "export const build = (a: string) => { if (a) { return a; } return 'none'; };",
            filename: PROMPT_FILE,
            name: 'a builder returning on two paths',
        },
        {
            code: 'export const build = (a: { text: string }) => a.text;',
            filename: PROMPT_FILE,
            name: 'a builder returning a member',
        },
        {
            code: 'const local = 1;\nexport { local };',
            filename: PROMPT_FILE,
            name: 'a re-export the file cannot judge',
        },
        {
            code: 'export type Variables = { topic: string };\nexport interface Options { tone: string }',
            filename: PROMPT_FILE,
            name: 'types',
        },
        {
            code: 'export default 1;',
            filename: AGENT_FILE,
            name: 'a file that is no prompt file',
        },
        {
            code: 'export const buildPrompt = (v: string): string => `Hello ${v}`;',
            filename: PROMPT_FILE,
            name: 'the canonical builder',
        },
        {
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
