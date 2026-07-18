import { isUnderAgentsFolder } from '../agents.js';
import { RULE_DOCS } from '../manifest.js';
import type { AstNode, LintRule, RuleContext, Visitor } from '../types.js';

/** A markdown heading — `#`, `##`, or `###` followed by a space. */
const MARKDOWN_HEADING = /^#{1,3}\s/;
/** A line reading as prose: 4+ tokens separated by whitespace. */
const MIN_PROSE_WORDS = 4;

/** Does `text` (one physical line) look like natural-language prose? */
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

/** Number of physical lines a source span covers, from a `\n` count. */
function lineSpan(text: string): number {
    return text.split('\n').length;
}

/**
 * CONVENTIONS P1 — the flagship rule: no multi-line natural-language literal
 * outside a `*.prompt.ts` file. A template literal is flagged when its full
 * source span reaches 3+ lines AND at least one of its own static quasis
 * (never the interpolated expressions) reads as prose — a line with 4+
 * space-separated words, or a markdown heading. Single-line literals, JSON-ish
 * multi-line literals, and pure data interpolation stay under the threshold
 * and pass.
 */
export const p1ProseInPromptFiles: LintRule = {
    create(context: RuleContext): Visitor {
        const file = context.physicalFilename;
        if (!isUnderAgentsFolder(file)) {
            return {};
        }
        const base = file.split(/[/\\]/).pop() ?? '';
        if (base.endsWith('.prompt.ts') || base.endsWith('.test.ts')) {
            return {};
        }
        const target = `${base.replace(/\.ts$/, '')}.prompt.ts`;

        return {
            TemplateLiteral(node: AstNode) {
                const start = (node.start as number | undefined) ?? (node.range as number[])?.[0];
                const end = (node.end as number | undefined) ?? (node.range as number[])?.[1];
                if (typeof start !== 'number' || typeof end !== 'number') {
                    return;
                }
                const fullText = context.sourceCode.text.slice(start, end);
                if (lineSpan(fullText) < 3) {
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
