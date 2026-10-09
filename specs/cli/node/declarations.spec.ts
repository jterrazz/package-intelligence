import { directory, packed } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

import { cli } from '../cli.specification.js';

describe('declarations', () => {
    test('a consumer compiles against the declarations the tarball ships', async () => {
        // Given - a consumer's agent configuration and middleware, with the compiler and the AI SDK beside the packed package
        const result = await cli
            .fixture(directory('./__fixtures__/consumer/'))
            .link('@jterrazz/intelligence', packed())
            .link('ai')
            .link('typescript')
            .exec('node_modules/typescript/bin/tsc -p .');

        // Then - the factory, the middleware and the formatting type-check, a wrong config is refused where the consumer expects it, and the compiler reports nothing
        expect(result.stdout.text).toBe('');
        expect(result.exitCode).toBe(0);
    });
});
