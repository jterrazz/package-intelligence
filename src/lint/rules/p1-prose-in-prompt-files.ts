import { isUnderAgentsFolder } from '../agents.js';
import { RULE_DOCS } from '../manifest.js';
import type { AstNode, LintRule, RuleContext, Visitor } from '../types.js';

const MARKDOWN_HEADING = /^#{1,3}\s/u;
const MIN_PROSE_WORDS = 4;
const MIN_PROSE_LINES = 3;

function looksLikeProseLine(line: string): boolean {
    const trimmed = line.trim();
    if (trimmed.length === 0) {
        return false;
    }
    if (MARKDOWN_HEADING.test(trimmed)) {
        return true;
    }
    const words = trimmed.split(/\s+/u).filter(Boolean);
    return words.length >= MIN_PROSE_WORDS;
}

function lineSpan(text: string): number {
    return text.split('\n').length;
}

export const p1ProseInPromptFiles: LintRule = {
    create(context: RuleContext): Visitor {
        const file = context.physicalFilename;
        if (!isUnderAgentsFolder(file)) {
            return {};
        }
        const base = file.split(/[/\\]/u).pop() ?? '';
        if (base.endsWith('.prompt.ts') || base.endsWith('.test.ts')) {
            return {};
        }
        const target = `${base.replace(/\.ts$/u, '')}.prompt.ts`;

        return {
            TemplateLiteral(node: AstNode) {
                const start = (node.start as number | undefined) ?? (node.range as number[])?.[0];
                const end = (node.end as number | undefined) ?? (node.range as number[])?.[1];
                if (typeof start !== 'number' || typeof end !== 'number') {
                    return;
                }
                const fullText = context.sourceCode.text.slice(start, end);
                if (lineSpan(fullText) < MIN_PROSE_LINES) {
                    return;
                }
                const quasis = (node.quasis as AstNode[] | undefined) ?? [];
                const hasProse = quasis.some((quasi) => {
                    const raw = (quasi.value as undefined | { raw?: string })?.raw ?? '';
                    return raw.split('\n').some(looksLikeProseLine);
                });
                if (hasProse) {
                    context.report({ data: { target }, messageId: 'moveProse', node });
                }
            },
        };
    },
    meta: {
        docs: RULE_DOCS['p1-prose-in-prompt-files'],
        messages: {
            moveProse:
                'Multi-line natural-language template literal outside a *.prompt.ts file — move prompt prose to {{target}} (P1).',
        },
        type: 'problem',
    },
};
