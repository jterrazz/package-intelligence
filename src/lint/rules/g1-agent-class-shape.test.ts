import { RuleTester } from 'oxlint/plugins-dev';
import { describe, it } from 'vitest';

import { g1AgentClassShape } from './g1-agent-class-shape.js';

RuleTester.describe = describe;
RuleTester.it = it;

type OxlintRule = Parameters<RuleTester['run']>[1];

const ruleTester = new RuleTester();

const AGENT_FILE = '/repo/src/infrastructure/outbound/agents/article-composer/article-composer.ts';
const NOT_AGENT_FILE = '/repo/src/infrastructure/outbound/agents/article-composer/helpers.ts';

const CANONICAL = `
export class ArticleComposer {
    static readonly SCHEMA = {};
    constructor(private readonly model, private readonly logger) {}
    async run(input) { return this.model; }
}
`;

ruleTester.run('g1-agent-class-shape', g1AgentClassShape as unknown as OxlintRule, {
    invalid: [
        {
            code: 'const build = () => {};',
            errors: [{ messageId: 'noExportedClass' }],
            filename: AGENT_FILE,
            name: 'no exported class',
        },
        {
            code: 'export class A { static readonly SCHEMA = {}; constructor(model) {} run() {} }\nexport class B {}',
            errors: [{ messageId: 'multipleExportedClasses' }],
            filename: AGENT_FILE,
            name: 'two exported classes',
        },
        {
            code: 'export class ArticleComposer { constructor(model) {} run() {} }',
            errors: [{ messageId: 'missingSchema' }],
            filename: AGENT_FILE,
            name: 'no static readonly SCHEMA',
        },
        {
            code: 'export class ArticleComposer { static readonly SCHEMA = {}; constructor(model) {} }',
            errors: [{ messageId: 'missingRun' }],
            filename: AGENT_FILE,
            name: 'no run method',
        },
        {
            code: 'export class ArticleComposer { static readonly SCHEMA = {}; constructor(client) {} run() {} }',
            errors: [{ messageId: 'missingConstructorModel' }],
            filename: AGENT_FILE,
            name: 'a first constructor parameter not named model',
        },
        {
            code: 'export class ArticleComposer { static readonly SCHEMA = {}; run() {} }',
            errors: [{ messageId: 'missingConstructorModel' }],
            filename: AGENT_FILE,
            name: 'no constructor',
        },
    ],
    valid: [
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
