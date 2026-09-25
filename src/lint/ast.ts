import type { AstNode } from './types.js';

export function segments(path: string): string[] {
    return path.split(/[/\\]/u).filter(Boolean);
}

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
            return (quasis[0]?.value as undefined | { cooked?: string })?.cooked;
        }
    }
    return undefined;
}

export function memberPropertyName(node: AstNode): string | undefined {
    if (node.type !== 'MemberExpression' || node.computed === true) {
        return undefined;
    }
    const property = node.property as AstNode | undefined;
    return property?.type === 'Identifier' ? (property.name as string) : undefined;
}
