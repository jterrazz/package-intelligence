import { describe, expect, test } from 'vitest';

import { intelligencePreset } from '../preset.js';

describe('preset', () => {
    test('the preset hands @jterrazz/typescript the plugin by its published subpath, every rule on at error', () => {
        // Given - the preset a repository lists in jterrazz.config.ts
        const preset = intelligencePreset();

        // Then - named for the package, each rule of the catalogue on, none at a warn tier
        expect(preset).toStrictEqual({
            name: 'intelligence',
            oxlint: {
                jsPlugins: ['@jterrazz/intelligence/oxlint'],
                rules: {
                    'intelligence/agent-class-shape': 'error',
                    'intelligence/agent-prompt-sibling': 'error',
                    'intelligence/model-resolution-in-composition': 'error',
                    'intelligence/no-hardcoded-model-id': 'error',
                    'intelligence/prompt-file-exports': 'error',
                    'intelligence/prose-in-prompt-files': 'error',
                },
            },
            package: '@jterrazz/intelligence',
        });
    });
});
