import { defineConfig } from 'tsdown';
import type { UserConfig } from 'tsdown';

// `config`, `formatting` and `oxlint` import nothing from the optional `ai` peer.
const config: UserConfig = defineConfig({
    clean: true,
    dts: true,
    entry: {
        config: 'src/config.ts',
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

export default config;
