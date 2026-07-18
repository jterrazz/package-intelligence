import { g1AgentClassShape } from './rules/g1-agent-class-shape.js';
import { m1ModelResolutionInContainer } from './rules/m1-model-resolution-in-container.js';
import { m2wNoHardcodedModelId } from './rules/m2w-no-hardcoded-model-id.js';
import { p1ProseInPromptFiles } from './rules/p1-prose-in-prompt-files.js';
import { p2PromptFileExports } from './rules/p2-prompt-file-exports.js';
import { p3AgentPromptSibling } from './rules/p3-agent-prompt-sibling.js';
import type { LintPlugin } from './types.js';

/**
 * The `@jterrazz/intelligence` oxlint plugin — formalizes the agent/prompt
 * folder convention documented in the README's "Agent & prompt conventions"
 * section as statically-checkable rules, mirroring `@jterrazz/test`'s
 * `src/lint/plugin.ts` (same composable-fragment architecture, same
 * `RuleTester` test layer, same manifest/docs-as-code pattern).
 *
 * Registered in a consumer's `oxlint.config.ts` via
 * `jsPlugins: ['@jterrazz/intelligence/oxlint']` and referenced as
 * `intelligence/<rule>` in the `rules` map — or enabled wholesale via the
 * {@link intelligence} composable fragment:
 *
 *     import { compose, node } from '@jterrazz/typescript/oxlint';
 *     import { intelligence } from '@jterrazz/intelligence/oxlint';
 *     export default compose(node, intelligence);
 *
 * Bundled by tsdown (`dist/oxlint.js`); rules import nothing from this
 * package's AI SDK runtime (only pure structural helpers: `ast.ts`, `fs.ts`,
 * `agents.ts`), so the bundle stays free of the `ai`/`@ai-sdk/*` dependency
 * graph the main entry pulls in.
 */
const plugin: LintPlugin = {
    meta: { name: 'intelligence' },
    rules: {
        'g1-agent-class-shape': g1AgentClassShape,
        'm1-model-resolution-in-container': m1ModelResolutionInContainer,
        'm2w-no-hardcoded-model-id': m2wNoHardcodedModelId,
        'p1-prose-in-prompt-files': p1ProseInPromptFiles,
        'p2-prompt-file-exports': p2PromptFileExports,
        'p3-agent-prompt-sibling': p3AgentPromptSibling,
    },
};

/**
 * The full catalogue at its intended severities — spread into an oxlint
 * `rules` map to enable everything in one line:
 *
 *     rules: { ...recommendedRules }
 *
 * Hard conventions are errors; `m2w-*` (the model-id heuristic) is a warning.
 */
export const recommendedRules: Record<string, 'error' | 'warn'> = Object.fromEntries(
    Object.keys(plugin.rules).map((rule) => [
        `intelligence/${rule}`,
        /^\w+w-/.test(rule) ? 'warn' : 'error',
    ]),
);

/**
 * The composable fragment — wire the plugin and enable the whole catalogue.
 * Designed to be composed with a base preset (e.g. `@jterrazz/typescript/oxlint`):
 *
 *     import { compose, node } from '@jterrazz/typescript/oxlint';
 *     import { intelligence } from '@jterrazz/intelligence/oxlint';
 *     export default compose(node, intelligence);
 *
 * `jsPlugins` registers the tool-facing entry, `rules` is {@link recommendedRules}.
 * `overrides` ships empty (no per-glob relaxation is needed today — every rule
 * gates itself by file path/name internally) but is kept on the fragment's
 * shape for parity with `@jterrazz/test`'s `testing` fragment and so a future
 * relaxation has somewhere to go without a breaking shape change.
 */
export const intelligence = {
    jsPlugins: ['@jterrazz/intelligence/oxlint'],
    overrides: [],
    rules: recommendedRules,
};

export default plugin;
