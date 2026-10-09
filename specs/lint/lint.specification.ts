import { specification } from '@jterrazz/test';
import { afterAll } from 'vitest';

import { recommendedRules } from '../../dist/oxlint.js';

export const { cleanup, lint } = await specification.lint({
    config: { categories: { correctness: 'off' }, rules: recommendedRules },
    plugins: ['../../dist/oxlint.js'],
});

afterAll(cleanup);
