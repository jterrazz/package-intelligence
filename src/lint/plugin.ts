import { g1AgentClassShape } from './rules/g1-agent-class-shape.js';
import { m1ModelResolutionInContainer } from './rules/m1-model-resolution-in-container.js';
import { m2wNoHardcodedModelId } from './rules/m2w-no-hardcoded-model-id.js';
import { p1ProseInPromptFiles } from './rules/p1-prose-in-prompt-files.js';
import { p2PromptFileExports } from './rules/p2-prompt-file-exports.js';
import { p3AgentPromptSibling } from './rules/p3-agent-prompt-sibling.js';
import type { LintFragment, LintPlugin, LintSeverity } from './types.js';

const HEURISTIC_RULE_ID = /^\w+w-/u;

/** The `intelligence` oxlint plugin: the agent/prompt folder convention as rules. */
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

/** Every rule at its shipped severity, to spread into an oxlint `rules` map. */
export const recommendedRules: Record<string, LintSeverity> = Object.fromEntries(
    Object.keys(plugin.rules).map((rule) => [
        `intelligence/${rule}`,
        HEURISTIC_RULE_ID.test(rule) ? 'warn' : 'error',
    ]),
);

/** The composable fragment: registers the plugin and enables every rule. */
export const intelligence: LintFragment = {
    jsPlugins: ['@jterrazz/intelligence/oxlint'],
    rules: recommendedRules,
};

export default plugin;
