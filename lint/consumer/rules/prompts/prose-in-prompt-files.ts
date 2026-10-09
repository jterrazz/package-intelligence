import { defineRule, readAt, rowNamed } from '@jterrazz/typescript/rules';
import { basename } from 'node:path';

import { isUnderAgentsFolder } from '../../../kit/project/agents.js';
import { childList } from '../../../kit/project/ast.js';
import type { AstNode, RuleContext, Visitor } from '../../../kit/project/rule.js';
import { CATALOGUE_CHAPTER } from '../../catalogue/chapter.js';
import { consumerRows } from '../../catalogue/manifest.js';

const MARKDOWN_HEADING = /^#{1,3}\s/u;
const MIN_PROSE_WORDS = 4;
const MIN_PROSE_LINES = 3;

function looksLikeProseLine(line: string): boolean {
    const trimmed = line.trim();
    return MARKDOWN_HEADING.test(trimmed) || trimmed.split(/\s+/u).length >= MIN_PROSE_WORDS;
}

function rawOf(quasi: AstNode): string {
    return String(Reflect.get(new Object(quasi.value), 'raw'));
}

function spanOf(node: AstNode, text: string): number {
    return text.slice(Number(node.start), Number(node.end)).split('\n').length;
}

const row = rowNamed(consumerRows, 'prose-in-prompt-files');

export const proseInPromptFiles = defineRule(
    {
        docs: row,
        messages: {
            moveProse: {
                fix: 'move the prose to {{target}}, as a function returning the string',
                found: 'a template literal of prose outside a `*.prompt.ts`',
            },
        },
        read: readAt(row, CATALOGUE_CHAPTER),
    },
    {
        create(context: RuleContext): Visitor {
            const file = context.physicalFilename;
            const base = basename(file);
            if (
                !isUnderAgentsFolder(file) ||
                base.endsWith('.prompt.ts') ||
                base.endsWith('.test.ts')
            ) {
                return {};
            }
            const target = `${base.replace(/\.ts$/u, '')}.prompt.ts`;
            return {
                TemplateLiteral(node: AstNode) {
                    if (spanOf(node, context.sourceCode.text) < MIN_PROSE_LINES) {
                        return;
                    }
                    const prose = childList(node, 'quasis').some((quasi) =>
                        rawOf(quasi).split('\n').some(looksLikeProseLine),
                    );
                    if (prose) {
                        context.report({ data: { target }, messageId: 'moveProse', node });
                    }
                },
            };
        },
    },
);
