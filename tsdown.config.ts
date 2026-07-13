import { defineConfig } from 'tsdown';

// Mirrors @jterrazz/typescript's `bundle` preset, with an extra dependency-free
// `text` entry so consumers can use parsing without the AI peer dependencies.
export default defineConfig({
    clean: true,
    dts: true,
    entry: {
        index: 'src/index.ts',
        text: 'src/text.ts',
    },
    format: ['esm', 'cjs'],
    hash: false,
    outExtensions: ({ format }) => ({
        js: format === 'cjs' ? '.cjs' : '.js',
    }),
    sourcemap: true,
});
