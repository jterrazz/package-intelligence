import type { AstNode } from './types.js';

/**
 * Shared AST helpers for the rule files. Everything here is pure and
 * structural: rules narrow nodes by `type` and read fields defensively, so the
 * layer stays decoupled from oxlint's internal (alpha) typings (mirrors
 * `@jterrazz/test`'s `src/lint/ast.ts`).
 */

/** Split a path into its non-empty segments (posix or win separators). */
export function segments(path: string): string[] {
    return path.split(/[/\\]/).filter(Boolean);
}

/** The string value of a plain string literal (or a template with no holes). */
export function stringValue(node: AstNode | undefined): string | undefined {
    if (node === undefined) {
        return undefined;
    }
    if (node.type === 'Literal' && typeof node.value === 'string') {
        return node.value;
    }
    if (node.type === 'TemplateLiteral') {
        const expressions = node.expressions as AstNode[] | undefined;
        const quasis = node.quasis as AstNode[] | undefined;
        if (expressions?.length === 0 && quasis?.length === 1) {
            return (quasis[0].value as undefined | { cooked?: string })?.cooked;
        }
    }
    return undefined;
}

/** The property name of a non-computed member expression, if identifiable. */
export function memberPropertyName(node: AstNode): string | undefined {
    if (node.type !== 'MemberExpression' || node.computed === true) {
        return undefined;
    }
    const property = node.property as AstNode | undefined;
    return property?.type === 'Identifier' ? (property.name as string) : undefined;
}
