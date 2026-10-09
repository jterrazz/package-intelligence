import { directory } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

import { lint } from '../lint.specification.js';

describe('exports', () => {
    test('refuses each export a prompt file may not make', async () => {
        // Given - a prompt file exporting a number, a builder of a number, a function declaration, a class and a default, beside its one good builder
        const result = await lint.fixture(directory('./__fixtures__/violation/')).run();

        // Then - one finding per export it may not make, with its lesson
        expect(result.report).toMatch(`
            src/infrastructure/outbound/agents/some-agent/some-agent.prompt.ts:1:14  intelligence(prompt-file-exports)
                found: the prompt file exports "MAX_LENGTH", which is no \`const\` arrow function
                why: A closed export surface keeps a prompt file a pure builder: state, a class or a default export would invite prompt logic to grow side effects.
                fix: export "MAX_LENGTH" as a \`const\` arrow function returning the string, or move it out of the prompt file
                read: docs/reference/lint-rules.md#prompt-file-exports
            src/infrastructure/outbound/agents/some-agent/some-agent.prompt.ts:5:41  intelligence(prompt-file-exports)
                found: "buildCount" does not return a string
                why: A closed export surface keeps a prompt file a pure builder: state, a class or a default export would invite prompt logic to grow side effects.
                fix: return the prompt text from "buildCount"
                read: docs/reference/lint-rules.md#prompt-file-exports
            src/infrastructure/outbound/agents/some-agent/some-agent.prompt.ts:7:1  intelligence(prompt-file-exports)
                found: the prompt file exports "buildFooter", which is no \`const\` arrow function
                why: A closed export surface keeps a prompt file a pure builder: state, a class or a default export would invite prompt logic to grow side effects.
                fix: export "buildFooter" as a \`const\` arrow function returning the string, or move it out of the prompt file
                read: docs/reference/lint-rules.md#prompt-file-exports
            src/infrastructure/outbound/agents/some-agent/some-agent.prompt.ts:11:1  intelligence(prompt-file-exports)
                found: the prompt file exports a class
                why: A closed export surface keeps a prompt file a pure builder: state, a class or a default export would invite prompt logic to grow side effects.
                fix: move the class out of the prompt file — an agent class sits in its \`<name>.ts\`
                read: docs/reference/lint-rules.md#prompt-file-exports
            src/infrastructure/outbound/agents/some-agent/some-agent.prompt.ts:13:1  intelligence(prompt-file-exports)
                found: the prompt file has a default export
                why: A closed export surface keeps a prompt file a pure builder: state, a class or a default export would invite prompt logic to grow side effects.
                fix: export the builder by name, \`export const build = (…) => …\`
                read: docs/reference/lint-rules.md#prompt-file-exports
        `);
    });
});
