import { testing } from '@jterrazz/test/oxlint';
import { compose, defineConfig, library } from '@jterrazz/typescript/oxlint';
import type { OxlintConfig } from '@jterrazz/typescript/oxlint';

// Its own plugin is read from dist/, so `npm run build` precedes `npm run lint`.
import { intelligence } from './dist/oxlint.js';

// `isolatedDeclarations` refuses a default export whose type it would infer.
const config: OxlintConfig = defineConfig(
    compose(library, testing, intelligence, {
        rules: {
            // reason: M1 gates a consumer's composition root; this package defines the factories it names.
            'intelligence/m1-model-resolution-in-container': 'off',
        },
    }),
);

export default config;
