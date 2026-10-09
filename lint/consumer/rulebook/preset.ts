import { definePreset } from '@jterrazz/typescript/config';
import type { Preset } from '@jterrazz/typescript/config';

import { consumerRows } from '../catalogue/manifest.js';

/** Every rule of the plugin, on at `error`: there is no warn tier. */
export const recommendedRules: Readonly<Record<string, 'error'>> = Object.fromEntries(
    consumerRows.map(({ name }) => [`intelligence/${name}`, 'error']),
);

/** The preset a repository lists in `jterrazz.config.ts`, `presets: [intelligence()]`. */
export function intelligencePreset(): Preset {
    return definePreset({
        name: 'intelligence',
        oxlint: { jsPlugins: ['@jterrazz/intelligence/oxlint'], rules: recommendedRules },
        package: '@jterrazz/intelligence',
    });
}
