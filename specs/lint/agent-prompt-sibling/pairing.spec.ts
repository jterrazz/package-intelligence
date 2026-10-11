import { directory } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

import { lint } from '../lint.specification.js';

describe('pairing', () => {
    test('refuses a prompt with no agent beside it, and an agent that does not import its prompt', async () => {
        // Given - a prompt file alone in its folder, and an agent that writes its prompt itself
        const result = await lint.fixture(directory('./__fixtures__/violation/')).run();

        // Then - a finding on each, with its lesson
        expect(result.report).toMatch(`
            src/infrastructure/outbound/agents/orphan-prompt/orphan-prompt.prompt.ts:1:1  intelligence(agent-prompt-sibling)
                found: \`orphan-prompt.prompt.ts\` has no agent \`orphan-prompt.ts\` in its folder
                why: The two-way link makes the pairing mechanical: an orphaned prompt, or an agent that does not use its prompt, is almost always a mistake.
                fix: write the agent \`orphan-prompt.ts\` beside its prompt, or move a prompt several agents share under a folder marked for its subject, \`_<subject>/\` such as \`_taxonomy/\`
                read: docs/reference/lint-rules.md#agent-prompt-sibling
            src/infrastructure/outbound/agents/unprompted/unprompted.ts:1:1  intelligence(agent-prompt-sibling)
                found: the agent file does not import its prompt from "./unprompted.prompt.js"
                why: The two-way link makes the pairing mechanical: an orphaned prompt, or an agent that does not use its prompt, is almost always a mistake.
                fix: import the prompt from "./unprompted.prompt.js"
                read: docs/reference/lint-rules.md#agent-prompt-sibling
        `);
    });
});
