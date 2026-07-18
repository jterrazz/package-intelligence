import { segments } from '../ast.js';
import { RULE_DOCS } from '../manifest.js';
import type { AstNode, LintRule, RuleContext, Visitor } from '../types.js';

/** `claude-…`, `gpt-4o`, `o1-preview`, `grok-2`, `deepseek-v3`, … */
const BARE_MODEL_ID =
    /^(?<family>claude|deepseek|gemini|gpt|grok|llama|mistral|o[0-9])[-0-9a-z.]/iu;
/** `openai/gpt-4o`, `anthropic/claude-3-5-sonnet`, … (provider-prefixed form). */
const PREFIXED_MODEL_ID = /^[a-z0-9-]+\/(?<family>claude|deepseek|gemini|gpt|grok|llama|mistral)/iu;

/** Config/test/fixture/spec files are exempt — that's exactly where a model id belongs. */
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

/**
 * CONVENTIONS M2 (warning) — a string literal shaped like a model id belongs
 * in configuration, not inlined in application code. Config/test/fixture/spec
 * files are exempt by design (oxlint only ever visits `.ts`/`.tsx` sources —
 * a `.yml`/`.json` config value is never in its reach regardless).
 */
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
