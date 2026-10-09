import { test } from '@jterrazz/test/config';
import { defineConfig, ownPresets } from '@jterrazz/typescript/config';

export default defineConfig({
    kind: 'library',
    platform: 'node',
    presets: [test(), ...ownPresets(import.meta.url, { './dist/config.js': 'intelligence' })],
    typescript: {
        knip: {
            ignoreDependencies: {
                '@cspell/dict-companies':
                    'read from node_modules by the preserved-terms generator, never imported',
                '@cspell/dict-software-terms':
                    'read from node_modules by the preserved-terms generator, never imported',
                'dictionary-en': 'toSentenceCase resolves its files at runtime, never imports them',
                'dictionary-fr': 'toSentenceCase resolves its files at runtime, never imports them',
            },
        },
        oxlint: {
            overrides: [
                {
                    files: ['scripts/**'],
                    reason: 'the generator is a command run in a terminal: it reports what it wrote on the console',
                    rules: { 'no-console': 'off' },
                },
                {
                    files: ['src/formatting/preserved-terms.generated.ts'],
                    reason: 'one literal table the generator writes, whose length is the dictionaries’, not code',
                    rules: { 'max-lines': 'off' },
                },
                {
                    files: ['src/factory/**'],
                    reason: 'createIntelligence is where the providers’ factories are called: the rule guards a consumer’s composition root, and this is the factory it names',
                    rules: { 'intelligence/model-resolution-in-composition': 'off' },
                },
            ],
        },
        roots: {
            scripts: 'the generator of the preserved-terms table `toSentenceCase` reads',
        },
    },
});
