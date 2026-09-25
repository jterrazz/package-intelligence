import { segments } from '../ast.js';
import { RULE_DOCS } from '../manifest.js';
import type { AstNode, LintRule, RuleContext, Visitor } from '../types.js';

const BARE_MODEL_ID =
    /^(?<family>claude|deepseek|gemini|gpt|grok|llama|mistral|o[0-9])[-0-9a-z.]/iu;
const PREFIXED_MODEL_ID = /^[a-z0-9-]+\/(?<family>claude|deepseek|gemini|gpt|grok|llama|mistral)/iu;

function isExemptFile(file: string): boolean {
    const parts = segments(file);
    const base = parts.at(-1) ?? '';
    if (/\.(?:test|spec)\.[cm]?tsx?$/u.test(base)) {
        return true;
    }
    if (parts.includes('fixtures') || parts.includes('specs') || parts.includes('__fixtures__')) {
        return true;
    }
    return parts.includes('config') || /\.config\.[cm]?tsx?$/u.test(base);
}

function looksLikeModelId(value: string): boolean {
    return BARE_MODEL_ID.test(value) || PREFIXED_MODEL_ID.test(value);
}

export const m2wNoHardcodedModelId: LintRule = {
    create(context: RuleContext): Visitor {
        const file = context.physicalFilename;
        if (isExemptFile(file)) {
            return {};
        }

        return {
            Literal(node: AstNode) {
                if (typeof node.value !== 'string') {
                    return;
                }
                if (looksLikeModelId(node.value)) {
                    context.report({
                        data: { value: node.value },
                        messageId: 'hardcodedModelId',
                        node,
                    });
                }
            },
        };
    },
    meta: {
        docs: RULE_DOCS['m2w-no-hardcoded-model-id'],
        messages: {
            hardcodedModelId:
                'String "{{value}}" looks like a model id — model ids belong in configuration (M2).',
        },
        type: 'suggestion',
    },
};
