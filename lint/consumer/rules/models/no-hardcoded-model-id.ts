import { defineRule, readAt, rowNamed } from '@jterrazz/typescript/rules';
import { basename } from 'node:path';

import { isTestMaterial, segments } from '../../../kit/project/paths.js';
import type { AstNode, RuleContext, Visitor } from '../../../kit/project/rule.js';
import { CATALOGUE_CHAPTER } from '../../catalogue/chapter.js';
import { consumerRows } from '../../catalogue/manifest.js';

const BARE_MODEL_ID = /^(?:claude|deepseek|gemini|gpt|grok|llama|mistral|o\d)[-\d.a-z]/iu;
const PREFIXED_MODEL_ID = /^[\da-z-]+\/(?:claude|deepseek|gemini|gpt|grok|llama|mistral)/iu;

function isExempt(file: string): boolean {
    const parts = segments(file);
    return (
        isTestMaterial(file) ||
        /\.config\.[cm]?tsx?$/u.test(basename(file)) ||
        parts.includes('config')
    );
}

const row = rowNamed(consumerRows, 'no-hardcoded-model-id');

export const noHardcodedModelId = defineRule(
    {
        docs: row,
        messages: {
            hardcodedModelId: {
                fix: 'read "{{value}}" from configuration, which the composition root hands on',
                found: '"{{value}}" reads as a model id written in the code',
            },
        },
        read: readAt(row, CATALOGUE_CHAPTER),
    },
    {
        create(context: RuleContext): Visitor {
            if (isExempt(context.physicalFilename)) {
                return {};
            }
            return {
                Literal(node: AstNode) {
                    const value = String(node.value);
                    if (BARE_MODEL_ID.test(value) || PREFIXED_MODEL_ID.test(value)) {
                        context.report({ data: { value }, messageId: 'hardcodedModelId', node });
                    }
                },
            };
        },
    },
);
