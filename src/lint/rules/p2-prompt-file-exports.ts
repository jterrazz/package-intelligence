import { RULE_DOCS } from '../manifest.js';
import type { AstNode, LintRule, RuleContext, Visitor } from '../types.js';

const TYPE_DECLARATIONS = new Set(['TSInterfaceDeclaration', 'TSTypeAliasDeclaration']);

// Permissive: P2 is a shape gate, not a type checker, so only a clearly non-string shape is rejected.
function looksLikeStringExpression(node: AstNode | undefined): boolean {
    if (node === undefined) {
        return false;
    }
    switch (node.type) {
        case 'BinaryExpression': {
            return node.operator === '+';
        }
        case 'CallExpression':
        case 'Identifier':
        case 'MemberExpression':
        case 'TemplateLiteral': {
            return true;
        }
        case 'ConditionalExpression': {
            return (
                looksLikeStringExpression(node.consequent as AstNode | undefined) &&
                looksLikeStringExpression(node.alternate as AstNode | undefined)
            );
        }
        case 'Literal': {
            return typeof node.value === 'string';
        }
        case 'LogicalExpression': {
            return looksLikeStringExpression(node.right as AstNode | undefined);
        }
        default: {
            return false;
        }
    }
}

function ownReturnExpressions(fn: AstNode): AstNode[] {
    const body = fn.body as AstNode | undefined;
    if (body === undefined) {
        return [];
    }
    if (body.type !== 'BlockStatement') {
        return [body];
    }
    const expressions: AstNode[] = [];
    const visit = (node: AstNode | undefined): void => {
        if (node === undefined) {
            return;
        }
        if (node.type === 'ReturnStatement') {
            const argument = node.argument as AstNode | undefined;
            if (argument !== undefined) {
                expressions.push(argument);
            }
            return;
        }
        if (
            node.type === 'ArrowFunctionExpression' ||
            node.type === 'FunctionExpression' ||
            node.type === 'FunctionDeclaration'
        ) {
            return;
        }
        for (const key of Object.keys(node)) {
            if (key === 'parent') {
                continue;
            }
            const value = node[key];
            if (Array.isArray(value)) {
                for (const item of value) {
                    if (isNode(item)) {
                        visit(item);
                    }
                }
            } else if (isNode(value)) {
                visit(value);
            }
        }
    };
    visit(body);
    return expressions;
}

function isNode(value: unknown): value is AstNode {
    return (
        typeof value === 'object' &&
        value !== null &&
        typeof (value as { type?: unknown }).type === 'string'
    );
}

export const p2PromptFileExports: LintRule = {
    create(context: RuleContext): Visitor {
        const file = context.physicalFilename;
        if (!file.endsWith('.prompt.ts')) {
            return {};
        }

        return {
            Program(node: AstNode) {
                for (const statement of (node.body as AstNode[] | undefined) ?? []) {
                    if (statement.type === 'ExportDefaultDeclaration') {
                        context.report({ messageId: 'defaultExport', node: statement });
                        continue;
                    }
                    if (statement.type !== 'ExportNamedDeclaration') {
                        continue;
                    }
                    const declaration = statement.declaration as AstNode | undefined;
                    if (declaration === undefined) {
                        // An `export { x }` re-export is out of static reach.
                        continue;
                    }
                    if (TYPE_DECLARATIONS.has(declaration.type)) {
                        continue;
                    }
                    if (declaration.type === 'ClassDeclaration') {
                        context.report({ messageId: 'classExport', node: statement });
                        continue;
                    }
                    if (declaration.type !== 'VariableDeclaration') {
                        const declId = declaration.id as AstNode | undefined;
                        const declName =
                            declId?.type === 'Identifier' ? (declId.name as string) : '?';
                        context.report({
                            data: { name: declName },
                            messageId: 'nonFunctionExport',
                            node: statement,
                        });
                        continue;
                    }
                    for (const declarator of (declaration.declarations as AstNode[] | undefined) ??
                        []) {
                        const id = declarator.id as AstNode | undefined;
                        const name = id?.type === 'Identifier' ? (id.name as string) : '?';
                        const init = declarator.init as AstNode | undefined;
                        if (init?.type !== 'ArrowFunctionExpression') {
                            context.report({
                                data: { name },
                                messageId: 'nonFunctionExport',
                                node: declarator,
                            });
                            continue;
                        }
                        const returnExpressions = ownReturnExpressions(init);
                        const badReturn =
                            returnExpressions.length === 0
                                ? init
                                : returnExpressions.find(
                                      (expression) => !looksLikeStringExpression(expression),
                                  );
                        if (badReturn !== undefined) {
                            context.report({
                                data: { name },
                                messageId: 'nonStringReturn',
                                node: badReturn,
                            });
                        }
                    }
                }
            },
        };
    },
    meta: {
        docs: RULE_DOCS['p2-prompt-file-exports'],
        messages: {
            classExport:
                'Prompt file exports a class — a *.prompt.ts file exports only const string-builder functions and types (P2).',
            defaultExport:
                'Prompt file has a default export — a *.prompt.ts file exports only const string-builder functions and types (P2).',
            nonFunctionExport:
                'Prompt file export "{{name}}" is not a const arrow function — a *.prompt.ts file exports only const string-builder functions and types (P2).',
            nonStringReturn:
                'Prompt file export "{{name}}" does not appear to return a string (P2).',
        },
        type: 'problem',
    },
};
