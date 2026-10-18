import { defineRule, readAt, rowNamed } from '@jterrazz/typescript/rules';

import { child, childList, identifierName, isNode } from '../../../kit/project/ast.js';
import type { AstNode, RuleContext, Visitor } from '../../../kit/project/rule.js';
import { CATALOGUE_CHAPTER } from '../../catalogue/chapter.js';
import { consumerRows } from '../../catalogue/manifest.js';

const TYPE_DECLARATIONS = new Set(['TSInterfaceDeclaration', 'TSTypeAliasDeclaration']);

const FUNCTIONS = new Set(['ArrowFunctionExpression', 'FunctionDeclaration', 'FunctionExpression']);

const STRING_SHAPED = new Set([
    'CallExpression',
    'Identifier',
    'MemberExpression',
    'TemplateLiteral',
]);

// invariant: a shape gate, not a type checker: only a return clearly not a string is refused.
function looksLikeString(node: AstNode | undefined): boolean {
    // Stryker disable next-line OptionalChaining: an operator always holds its operands, and a return its argument by then
    switch (node?.type) {
        case 'BinaryExpression': {
            return node.operator === '+';
        }
        case 'ConditionalExpression': {
            return (
                looksLikeString(child(node, 'consequent')) &&
                looksLikeString(child(node, 'alternate'))
            );
        }
        case 'Literal': {
            return typeof node.value === 'string';
        }
        case 'LogicalExpression': {
            return looksLikeString(child(node, 'right'));
        }
        default: {
            // Stryker disable next-line OptionalChaining: an operator always holds its operands, and a return its argument by then
            return STRING_SHAPED.has(String(node?.type));
        }
    }
}

function childrenOf(node: AstNode): AstNode[] {
    return Object.entries(node)
        .filter(([key]) => key !== 'parent')
        .flatMap(([, value]): unknown[] => (Array.isArray(value) ? value : [value]))
        .filter(isNode);
}

function returnedBy(body: AstNode): AstNode[] {
    if (body.type === 'ReturnStatement') {
        const argument = child(body, 'argument');
        return argument === undefined ? [] : [argument];
    }
    return FUNCTIONS.has(body.type) ? [] : childrenOf(body).flatMap(returnedBy);
}

function ownReturns(arrow: AstNode): AstNode[] {
    const body = child(arrow, 'body');
    // Stryker disable ConditionalExpression,BlockStatement,ArrayDeclaration: an arrow function always has a body
    if (body === undefined) {
        return [];
    }
    // Stryker restore ConditionalExpression,BlockStatement,ArrayDeclaration
    return body.type === 'BlockStatement' ? returnedBy(body) : [body];
}

const row = rowNamed(consumerRows, 'prompt-file-exports');

export const promptFileExports = defineRule(
    {
        docs: row,
        messages: {
            classExport: {
                fix: 'move the class out of the prompt file: an agent class sits in its `<name>.ts`',
                found: 'the prompt file exports a class',
            },
            defaultExport: {
                fix: 'export the builder by name, `export const build = (...) => ...`',
                found: 'the prompt file has a default export',
            },
            nonFunctionExport: {
                fix: 'export "{{name}}" as a `const` arrow function returning the string, or move it out of the prompt file',
                found: 'the prompt file exports "{{name}}", which is no `const` arrow function',
            },
            nonStringReturn: {
                fix: 'return the prompt text from "{{name}}"',
                found: '"{{name}}" does not return a string',
            },
        },
        read: readAt(row, CATALOGUE_CHAPTER),
    },
    {
        create(context: RuleContext): Visitor {
            if (!context.physicalFilename.endsWith('.prompt.ts')) {
                return {};
            }
            const judgeDeclarator = (declarator: AstNode): void => {
                // Stryker disable next-line StringLiteral: the name a finding prints when the export binds a pattern, which no lesson spells
                const name = identifierName(child(declarator, 'id')) ?? '?';
                const init = child(declarator, 'init');
                if (init?.type !== 'ArrowFunctionExpression') {
                    context.report({
                        data: { name },
                        messageId: 'nonFunctionExport',
                        node: declarator,
                    });
                    return;
                }
                const returns = ownReturns(init);
                const bad =
                    returns.length === 0 ? init : returns.find((value) => !looksLikeString(value));
                if (bad !== undefined) {
                    context.report({ data: { name }, messageId: 'nonStringReturn', node: bad });
                }
            };
            const judgeExport = (statement: AstNode): void => {
                const declaration = child(statement, 'declaration');
                // outside: an `export { x }` re-export names a value this file cannot see.
                if (declaration === undefined || TYPE_DECLARATIONS.has(declaration.type)) {
                    return;
                }
                if (declaration.type === 'ClassDeclaration') {
                    context.report({ messageId: 'classExport', node: statement });
                } else if (declaration.type === 'VariableDeclaration') {
                    for (const declarator of childList(declaration, 'declarations')) {
                        judgeDeclarator(declarator);
                    }
                } else {
                    // Stryker disable next-line StringLiteral,LogicalOperator: every declaration TypeScript lets a file export by name carries an identifier
                    const name = identifierName(child(declaration, 'id')) ?? '?';
                    context.report({
                        data: { name },
                        messageId: 'nonFunctionExport',
                        node: statement,
                    });
                }
            };
            return {
                Program(node: AstNode) {
                    for (const statement of childList(node, 'body')) {
                        if (statement.type === 'ExportDefaultDeclaration') {
                            context.report({ messageId: 'defaultExport', node: statement });
                        } else {
                            judgeExport(statement);
                        }
                    }
                },
            };
        },
    },
);
