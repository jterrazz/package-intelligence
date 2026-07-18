import { defineConfig } from 'tsdown';

// Mirrors @jterrazz/typescript's `bundle` preset, with two extra dependency-free
// Entries: `formatting` (text formatting without the AI peer dependencies) and
// `oxlint` (the agent/prompt convention plugin — imports nothing from the `ai`/
// `@ai-sdk/*` runtime, so it stays free of that dependency graph too).
export default defineConfig({
    clean: true,
    dts: true,
    entry: {
        formatting: 'src/formatting.ts',
        index: 'src/index.ts',
        oxlint: 'src/lint/plugin.ts',
    },
    format: ['esm', 'cjs'],
    hash: false,
    outExtensions: ({ format }) => ({
        js: format === 'cjs' ? '.cjs' : '.js',
    }),
    sourcemap: true,
});
