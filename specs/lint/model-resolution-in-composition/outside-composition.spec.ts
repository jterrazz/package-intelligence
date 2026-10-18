import { directory } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

import { lint } from '../lint.specification.js';

describe('outside-composition', () => {
    test('refuses a model resolved outside the composition root', async () => {
        // Given - a wiring file that builds the factory and resolves a model by name
        const result = await lint.fixture(directory('./__fixtures__/violation/')).run();

        // Then - a finding on each call, with its lesson
        expect(result.report).toMatch(`
            src/wiring/setup.ts:3:22  intelligence(model-resolution-in-composition)
                found: \`createIntelligence()\` is called outside the composition root
                why: Model resolution is the composition root's work: scattered, a provider or model choice drifts outside the one place meant to own it.
                fix: call \`createIntelligence()\` from a file under \`composition/\`, and hand what it builds to the code that needs it
                read: docs/reference/lint-rules.md#model-resolution-in-composition
            src/wiring/setup.ts:5:22  intelligence(model-resolution-in-composition)
                found: \`.model('...')\` resolves a model outside the composition root
                why: Model resolution is the composition root's work: scattered, a provider or model choice drifts outside the one place meant to own it.
                fix: resolve the model in a file under \`composition/\`, and hand the model on
                read: docs/reference/lint-rules.md#model-resolution-in-composition
        `);
    });
});
