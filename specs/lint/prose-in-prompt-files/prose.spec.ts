import { directory } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

import { lint } from '../lint.specification.js';

describe('prose', () => {
    test('refuses prose written in the agent class', async () => {
        // Given - an agent whose run method holds a three-line prompt
        const result = await lint.fixture(directory('./__fixtures__/violation/')).run();

        // Then - the finding on the literal, with its lesson
        expect(result.report).toMatch(`
            src/infrastructure/outbound/agents/prosey-agent/prosey-agent.ts:13:24  intelligence(prose-in-prompt-files)
                found: a template literal of prose outside a \`*.prompt.ts\`
                why: The agent class only shapes data: prose that leaks into it hides the prompt contract, and the two can no longer be reviewed apart.
                fix: move the prose to prosey-agent.prompt.ts, as a function returning the string
                read: docs/reference/lint-rules.md#prose-in-prompt-files
        `);
    });
});
