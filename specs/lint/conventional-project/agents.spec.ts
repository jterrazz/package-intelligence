import { directory } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

import { lint } from '../lint.specification.js';

describe('agents', () => {
    test('an agent project laid out by the conventions passes every rule', async () => {
        // Given - an agent with its prompt beside it, and the model resolved in the composition root
        const result = await lint.fixture(directory('./__fixtures__/agent-project/')).run();

        // Then - no rule reports
        expect(result.report).toMatch('');
    });
});
