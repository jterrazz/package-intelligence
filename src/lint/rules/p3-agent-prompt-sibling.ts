import { join } from 'node:path';

import { detectAgentFile, detectPromptFile } from '../agents.js';
import { stringValue } from '../ast.js';
import { fileExists } from '../fs.js';
import { RULE_DOCS } from '../manifest.js';
import type { AstNode, LintRule, RuleContext, Visitor } from '../types.js';

/**
 * CONVENTIONS P3 — the two-way link between an agent file and its prompt:
 *
 * - an agent file (`agents/<name>/<name>.ts`) imports its prompt from
 *   `./<name>.prompt.js` (best effort: checks for the import SOURCE string,
 *   not that the imported bindings are actually used);
 * - a `<name>.prompt.ts` file outside `_shared/` has a sibling `<name>.ts`
 *   in the same directory (`fs.existsSync` — mirrors `@jterrazz/test`'s
 *   `c8-referenced-fixture-exists`, the same on-disk-reference pattern).
 */
export const p3AgentPromptSibling: LintRule = {
    create(context: RuleContext): Visitor {
        const file = context.physicalFilename;
        const agent = detectAgentFile(file);
        const prompt = agent === undefined ? detectPromptFile(file) : undefined;
        if (agent === undefined && prompt === undefined) {
            return {};
        }

        return {
            Program(node: AstNode) {
                if (agent !== undefined) {
                    const expected = `./${agent.name}.prompt.js`;
                    const hasImport = ((node.body as AstNode[] | undefined) ?? []).some(
                        (statement) =>
                            statement.type === 'ImportDeclaration' &&
                            stringValue(statement.source as AstNode | undefined) === expected,
                    );
                    if (!hasImport) {
                        context.report({
                            data: { expected },
                            messageId: 'missingPromptImport',
                            node,
                        });
                    }
                    return;
                }
                if (prompt !== undefined && !prompt.shared) {
                    const sibling = join(prompt.dir, `${prompt.name}.ts`);
                    if (!fileExists(sibling)) {
                        context.report({
                            data: { name: prompt.name },
                            messageId: 'missingAgentSibling',
                            node,
                        });
                    }
                }
            },
        };
    },
    meta: {
        docs: RULE_DOCS['p3-agent-prompt-sibling'],
        messages: {
            missingAgentSibling:
                'Prompt file "{{name}}.prompt.ts" has no sibling agent file "{{name}}.ts" in the same directory (P3).',
            missingPromptImport: 'Agent file must import its prompt from "{{expected}}" (P3).',
        },
        type: 'problem',
    },
};
