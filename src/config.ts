import { intelligence as rules } from './lint/plugin.js';
import type { LintFragment } from './lint/types.js';

/** A `@jterrazz/typescript` preset, written as its `definePreset` takes it: this package's oxlint rules, under its name. */
export type IntelligencePreset = {
    name: 'intelligence';
    oxlint: LintFragment;
    package: '@jterrazz/intelligence';
};

/** The preset a repository lists in `jterrazz.config.ts`, `presets: [intelligence()]`: the agent, prompt and model-resolution rules, at their shipped severity. */
export function intelligence(): IntelligencePreset {
    return { name: 'intelligence', oxlint: rules, package: '@jterrazz/intelligence' };
}
