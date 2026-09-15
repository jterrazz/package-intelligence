import { compose, defineConfig, library, type OxlintConfig } from '@jterrazz/typescript/oxlint';

// This package is consumer #1 of the convention it ships: it lints itself with its own
// plugin. The fragment names `@jterrazz/intelligence/oxlint`, which Node resolves from
// inside the package to `dist/oxlint.js` — so `npm run build` precedes `npm run lint`.
import { intelligence } from './dist/oxlint.js';

// The `library` tsconfig's `isolatedDeclarations` refuses a default export whose type it
// would have to infer, so this config names its own type.
const config: OxlintConfig = defineConfig(
    compose(library, intelligence, {
        rules: {
            // reason: M1 gates a CONSUMER's composition root. This package defines the
            // factories it names, so every call in this tree is that definition or its
            // own test — there is no container here for them to move to.
            'intelligence/m1-model-resolution-in-container': 'off',
        },
    }),
);

export default config;
