import { defineRule, readAt, rowNamed } from '@jterrazz/typescript/rules';

import { detectAgentFile, detectPromptFile, siblingExists } from '../../../kit/project/agents.js';
import { child, childList, stringValue } from '../../../kit/project/ast.js';
import type { AstNode, RuleContext, Visitor } from '../../../kit/project/rule.js';
import { CATALOGUE_CHAPTER } from '../../catalogue/chapter.js';
import { consumerRows } from '../../catalogue/manifest.js';

function importsFrom(program: AstNode, expected: string): boolean {
    return childList(program, 'body').some(
        (statement) =>
            statement.type === 'ImportDeclaration' &&
            stringValue(child(statement, 'source')) === expected,
    );
}

const row = rowNamed(consumerRows, 'agent-prompt-sibling');

export const agentPromptSibling = defineRule(
    {
        docs: row,
        messages: {
            missingAgentSibling: {
                fix: 'write the agent `{{name}}.ts` beside its prompt, or move a prompt several agents share under `_shared/`',
                found: '`{{name}}.prompt.ts` has no agent `{{name}}.ts` in its folder',
            },
            missingPromptImport: {
                fix: 'import the prompt from "{{expected}}"',
                found: 'the agent file does not import its prompt from "{{expected}}"',
            },
        },
        read: readAt(row, CATALOGUE_CHAPTER),
    },
    {
        create(context: RuleContext): Visitor {
            const file = context.physicalFilename;
            const agent = detectAgentFile(file);
            if (agent !== undefined) {
                const expected = `./${agent.name}.prompt.js`;
                return {
                    Program(node: AstNode) {
                        if (!importsFrom(node, expected)) {
                            context.report({
                                data: { expected },
                                messageId: 'missingPromptImport',
                                node,
                            });
                        }
                    },
                };
            }
            const prompt = detectPromptFile(file);
            if (prompt === undefined || prompt.shared || siblingExists(prompt)) {
                return {};
            }
            return {
                Program(node: AstNode) {
                    context.report({
                        data: { name: prompt.name },
                        messageId: 'missingAgentSibling',
                        node,
                    });
                },
            };
        },
    },
);
