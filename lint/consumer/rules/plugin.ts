import type { LintPlugin } from '../../kit/project/rule.js';
import { agentClassShape } from './agents/agent-class-shape.js';
import { agentPromptSibling } from './agents/agent-prompt-sibling.js';
import { modelResolutionInComposition } from './models/model-resolution-in-composition.js';
import { noHardcodedModelId } from './models/no-hardcoded-model-id.js';
import { promptFileExports } from './prompts/prompt-file-exports.js';
import { proseInPromptFiles } from './prompts/prose-in-prompt-files.js';

const plugin: LintPlugin = {
    meta: { name: 'intelligence' },
    rules: Object.fromEntries(
        [
            agentClassShape,
            agentPromptSibling,
            modelResolutionInComposition,
            noHardcodedModelId,
            promptFileExports,
            proseInPromptFiles,
        ].map((rule) => [rule.meta.docs.name, rule]),
    ),
};

export default plugin;
