import { RULE_DOCS } from '../manifest.js';
import type { AstNode, LintRule, RuleContext, Visitor } from '../types.js';

/** Declaration types that are types, not values — always allowed. */
const TYPE_DECLARATIONS = new Set(['TSInterfaceDeclaration', 'TSTypeAliasDeclaration']);

/**
 * Best-effort "does this expression plausibly evaluate to a string?" check.
 * Permissive by design (P2 is a shape gate, not a type checker): a delegated
 * call (`return sharedSection();`), a bare identifier, member access, string
 * concatenation, and `? :` / `||` narrowing all pass. Only expressions that
 * are CLEARLY the wrong shape — an object/array literal, a non-string literal,
 * a nested function — are rejected.
 */
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

/**
 * The expressions `fn` itself returns — the concise-arrow expression body, or
 * every top-level `return`'s argument in a block body (never descending into a
 * nested function's own returns). Each is a REAL AST node (unlike a synthetic
 * `ReturnStatement` wrapper), so it always carries a valid position to report on.
 */
function ownReturnExpressions(fn: AstNode): AstNode[] {
    const body = fn.body as AstNode | undefined;
    if (body === undefined) {
        return [];
    }
    if (body.type !== 'BlockStatement') {
        // Concise arrow body: `() => expr` — the body IS the returned expression.
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
            return; // Do not descend into a nested function's own returns.
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

/**
 * CONVENTIONS P2 — a `*.prompt.ts` file's export surface is closed: const
 * arrow functions returning a string (the builders), and types/interfaces.
 * No default export, no class, no non-function const, no plain `function`
 * declaration (the convention is arrow consts specifically — see the
 * README's "Agent & prompt conventions" section).
 */
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
                        continue; // `export { x };` re-export form — out of P2's static reach.
                    }
                    if (TYPE_DECLARATIONS.has(declaration.type)) {
                        continue;
                    }
                    if (declaration.type === 'ClassDeclaration') {
                        context.report({ messageId: 'classExport', node: statement });
                        continue;
                    }
                    if (declaration.type !== 'VariableDeclaration') {
                        // FunctionDeclaration, TSEnumDeclaration, etc. — not the arrow-const shape.
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
                        // A block body with no `return` at all returns `undefined` —
                        // Report on the arrow function itself (a real node either way).
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
