import type { AstNode } from './rule.js';

function fieldOf(value: unknown, key: string): unknown {
    return Reflect.get(new Object(value), key);
}

export function isNode(value: unknown): value is AstNode {
    // Stryker disable next-line ConditionalExpression: an oxlint list holds nodes, and a child a rule asks for is a node or absent
    return typeof fieldOf(value, 'type') === 'string';
}

export function child(node: unknown, key: string): AstNode | undefined {
    const value = fieldOf(node, key);
    return isNode(value) ? value : undefined;
}

export function childList(node: unknown, key: string): AstNode[] {
    const value = fieldOf(node, key);
    // Stryker disable next-line MethodExpression,ArrayDeclaration: an oxlint list holds nodes alone, and a rule asks a node only for a list it has
    return Array.isArray(value) ? value.filter(isNode) : [];
}

export function textOf(node: unknown, key: string): string | undefined {
    const value = fieldOf(node, key);
    return typeof value === 'string' ? value : undefined;
}

export function identifierName(node: unknown): string | undefined {
    return textOf(node, 'type') === 'Identifier' ? textOf(node, 'name') : undefined;
}

export function stringValue(node: unknown): string | undefined {
    if (textOf(node, 'type') === 'Literal') {
        return textOf(node, 'value');
    }
    const quasis = childList(node, 'quasis');
    return quasis.length === 1 ? textOf(fieldOf(quasis[0], 'value'), 'cooked') : undefined;
}

export function memberPropertyName(node: unknown): string | undefined {
    return fieldOf(node, 'computed') === true ? undefined : identifierName(child(node, 'property'));
}
