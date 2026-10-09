import { directory } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

import { lint } from '../lint.specification.js';

describe('literal', () => {
    test('refuses a model id written in the code', async () => {
        // Given - a provider module holding a model id literal
        const result = await lint.fixture(directory('./__fixtures__/violation/')).run();

        // Then - the finding on the literal, with its lesson
        expect(result.report).toMatch(`
            src/infrastructure/outbound/providers/model-choice.ts:1:30  intelligence(no-hardcoded-model-id)
                found: "claude-3-5-sonnet-20241022" reads as a model id written in the code
                why: A model id written in application code changes only with a deploy; in configuration it changes without one.
                fix: read "claude-3-5-sonnet-20241022" from configuration, which the composition root hands on
                read: docs/reference/lint-rules.md#no-hardcoded-model-id
        `);
    });
});
