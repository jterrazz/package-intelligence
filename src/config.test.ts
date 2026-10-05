import { expect, test } from 'vitest';

import { intelligence } from './config.js';

test('the preset hands @jterrazz/typescript this package’s plugin, every rule at its shipped severity', () => {
    // Given - the preset a repository lists in jterrazz.config.ts
    const preset = intelligence();

    // Then - named for the package, the plugin registered by its published subpath, each rule on
    expect(preset).toStrictEqual({
        name: 'intelligence',
        oxlint: {
            jsPlugins: ['@jterrazz/intelligence/oxlint'],
            rules: {
                'intelligence/g1-agent-class-shape': 'error',
                'intelligence/m1-model-resolution-in-composition': 'error',
                'intelligence/m2w-no-hardcoded-model-id': 'warn',
                'intelligence/p1-prose-in-prompt-files': 'error',
                'intelligence/p2-prompt-file-exports': 'error',
                'intelligence/p3-agent-prompt-sibling': 'error',
            },
        },
        package: '@jterrazz/intelligence',
    });
});
