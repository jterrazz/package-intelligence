import { ruleTester } from '@jterrazz/test';

import { agentClassShape } from '../agent-class-shape.js';

const AGENT_FILE = '/repo/src/infrastructure/outbound/agents/article-composer/article-composer.ts';
const NOT_AGENT_FILE = '/repo/src/infrastructure/outbound/agents/article-composer/helpers.ts';

const CANONICAL = `
export class ArticleComposer {
    static readonly SCHEMA = {};
    constructor(private readonly model, private readonly logger) {}
    async run(input) { return this.model; }
}
`;

ruleTester().run('agent-class-shape', agentClassShape, {
    invalid: [
        {
            code: 'export class ArticleComposer { static readonly SCHEMA = {}; constructor() {} run() {} }',
            errors: [{ column: 60, line: 1, messageId: 'missingConstructorModel' }],
            filename: AGENT_FILE,
            name: 'a constructor that takes nothing',
        },
        {
            code: 'class ArticleComposer { static readonly SCHEMA = {}; constructor(model) {} run() {} }\nexport { ArticleComposer };',
            errors: [{ column: 0, line: 1, messageId: 'noExportedClass' }],
            filename: AGENT_FILE,
            name: 'a class exported by name after it is declared',
        },
        {
            code: 'export class ArticleComposer { readonly SCHEMA = {}; constructor(model) {} run() {} }',
            errors: [{ column: 7, line: 1, messageId: 'missingSchema' }],
            filename: AGENT_FILE,
            name: 'a SCHEMA that is not static',
        },
        {
            code: 'export class ArticleComposer { static readonly SCHEMA = {}; constructor({ model }) {} run() {} }',
            errors: [{ column: 72, line: 1, messageId: 'missingConstructorModel' }],
            filename: AGENT_FILE,
            name: 'a model destructured from the first parameter',
        },
        {
            code: 'export const ArticleComposer = class { static readonly SCHEMA = {}; constructor(model) {} run() {} };',
            errors: [{ column: 0, line: 1, messageId: 'noExportedClass' }],
            filename: AGENT_FILE,
            name: 'a class expression exported by name',
        },
        {
            code: 'export function run() {}',
            errors: [{ column: 0, line: 1, messageId: 'noExportedClass' }],
            filename: AGENT_FILE,
            name: 'an agent file exporting a function',
        },
        {
            code: 'const build = () => {};',
            errors: [{ column: 0, line: 1, messageId: 'noExportedClass' }],
            filename: AGENT_FILE,
            name: 'no exported class',
        },
        {
            code: 'export class A { static readonly SCHEMA = {}; constructor(model) {} run() {} }\nexport class B {}',
            errors: [{ column: 7, line: 2, messageId: 'multipleExportedClasses' }],
            filename: AGENT_FILE,
            name: 'two exported classes',
        },
        {
            code: 'export class ArticleComposer { constructor(model) {} run() {} }',
            errors: [{ column: 7, line: 1, messageId: 'missingSchema' }],
            filename: AGENT_FILE,
            name: 'no static readonly SCHEMA',
        },
        {
            code: 'export class ArticleComposer { static readonly SCHEMA = {}; constructor(model) {} }',
            errors: [{ column: 7, line: 1, messageId: 'missingRun' }],
            filename: AGENT_FILE,
            name: 'no run method',
        },
        {
            code: 'export class ArticleComposer { static readonly SCHEMA = {}; constructor(client) {} run() {} }',
            errors: [{ column: 72, line: 1, messageId: 'missingConstructorModel' }],
            filename: AGENT_FILE,
            name: 'a first constructor parameter not named model',
        },
        {
            code: 'export class ArticleComposer { static readonly SCHEMA = {}; run() {} }',
            errors: [{ column: 7, line: 1, messageId: 'missingConstructorModel' }],
            filename: AGENT_FILE,
            name: 'no constructor',
        },
    ],
    valid: [
        {
            code: 'export const VERSION = 1;\nexport class ArticleComposer { static readonly SCHEMA = {}; constructor(model) {} run() {} }',
            filename: AGENT_FILE,
            name: 'a constant exported before the class',
        },
        {
            code: 'export default (class { static readonly SCHEMA = {}; constructor(model) {} run() {} });',
            filename: AGENT_FILE,
            name: 'a class expression as the default export',
        },
        {
            code: 'export default class { static readonly SCHEMA = {}; constructor(model) {} run() {} }',
            filename: AGENT_FILE,
            name: 'an anonymous class as the default export',
        },
        {
            code: 'export class ArticleComposer { static readonly SCHEMA = {}; constructor(model = undefined) {} run = async () => undefined; }',
            filename: AGENT_FILE,
            name: 'a model with a default, and run as a property',
        },
        {
            code: 'export const helper = 1;',
            filename:
                '/repo/src/infrastructure/outbound/agents/article-composer/article-composer.test.ts',
            name: 'a test beside the agent',
        },
        {
            code: 'export const helper = 1;',
            filename:
                '/repo/src/infrastructure/outbound/agents/article-composer/article-composer.js',
            name: 'a file that is no TypeScript',
        },
        {
            code: 'export const helper = 1;',
            filename: '/repo/src/article-composer/article-composer.ts',
            name: 'a folder outside agents/',
        },
        {
            code: 'export const helper = 1;',
            filename: '/repo/src/agents/agents.ts',
            name: 'a file named for the agents folder itself',
        },
        {
            code: CANONICAL,
            filename: AGENT_FILE,
            name: 'the canonical shape',
        },
        {
            code: 'export class ArticleComposer { static readonly SCHEMA = {}; constructor(private readonly model: unknown) {} run() {} }',
            filename: AGENT_FILE,
            name: 'a parameter property named model',
        },
        {
            code: 'export class NotAnAgent {}',
            filename: NOT_AGENT_FILE,
            name: 'a basename unlike its folder is not an agent file',
        },
        {
            code: 'export class WhateverInTest {}',
            filename:
                '/repo/src/infrastructure/outbound/agents/article-composer/article-composer.test.ts',
            name: 'a test sibling is not an agent file',
        },
    ],
});
