import { directory } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

import { lint } from '../lint.specification.js';

describe('shape', () => {
    test('refuses each part an agent class misses, where it is missing', async () => {
        // Given - six agents, each missing one part: its class, its uniqueness, its SCHEMA, its run, its constructor, its model
        const result = await lint.fixture(directory('./__fixtures__/violation/')).run();

        // Then - one finding per agent, each with its lesson
        expect(result.report).toMatch(`
            src/infrastructure/outbound/agents/bad-agent/bad-agent.ts:8:17  intelligence(agent-class-shape)
                found: the agent class’s constructor takes no \`model\` first
                why: A fixed shape makes every agent class predictable to read and to wire from the composition root without re-deriving its contract each time.
                fix: name the first constructor parameter \`model\`, the language model the composition root hands it
                read: docs/reference/lint-rules.md#agent-class-shape
            src/infrastructure/outbound/agents/no-class/no-class.ts:1:1  intelligence(agent-class-shape)
                found: the agent file exports no class
                why: A fixed shape makes every agent class predictable to read and to wire from the composition root without re-deriving its contract each time.
                fix: export the agent class from its file
                read: docs/reference/lint-rules.md#agent-class-shape
            src/infrastructure/outbound/agents/no-constructor/no-constructor.ts:3:8  intelligence(agent-class-shape)
                found: the agent class’s constructor takes no \`model\` first
                why: A fixed shape makes every agent class predictable to read and to wire from the composition root without re-deriving its contract each time.
                fix: name the first constructor parameter \`model\`, the language model the composition root hands it
                read: docs/reference/lint-rules.md#agent-class-shape
            src/infrastructure/outbound/agents/no-run/no-run.ts:3:8  intelligence(agent-class-shape)
                found: the agent class has no \`run\` method
                why: A fixed shape makes every agent class predictable to read and to wire from the composition root without re-deriving its contract each time.
                fix: give the class its \`run\` method, the one call its users make
                read: docs/reference/lint-rules.md#agent-class-shape
            src/infrastructure/outbound/agents/no-schema/no-schema.ts:3:8  intelligence(agent-class-shape)
                found: the agent class has no \`static readonly SCHEMA\`
                why: A fixed shape makes every agent class predictable to read and to wire from the composition root without re-deriving its contract each time.
                fix: declare the output schema as \`static readonly SCHEMA\`
                read: docs/reference/lint-rules.md#agent-class-shape
            src/infrastructure/outbound/agents/two-classes/two-classes.ts:13:8  intelligence(agent-class-shape)
                found: the agent file exports a second class
                why: A fixed shape makes every agent class predictable to read and to wire from the composition root without re-deriving its contract each time.
                fix: keep one class per agent file, and move the other to a file of its own
                read: docs/reference/lint-rules.md#agent-class-shape
        `);
    });
});
