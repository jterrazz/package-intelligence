import { memberPropertyName, stringValue } from '../ast.js';
import { RULE_DOCS } from '../manifest.js';
import type { AstNode, LintRule, RuleContext, Visitor } from '../types.js';

/** The composition-root factories `@jterrazz/intelligence` exposes. */
const FACTORY_NAMES = new Set([
    'createGatewayProvider',
    'createIntelligence',
    'createOpenRouterProvider',
]);

/** Is `file` a DI/composition-root file? */
function isContainerFile(file: string): boolean {
    return file.includes('/di/') || file.endsWith('container.ts');
}

/**
 * CONVENTIONS M1 — model resolution is composition-root work. `createIntelligence`
 * and the two provider factories, plus `.model('…')` calls on whatever they
 * produce, are only allowed in a file under `di/` or named `*container.ts`.
 *
 * Detection is best effort by design: a `.model(<string literal>)` call is
 * flagged wherever it appears in a file that imports `@jterrazz/intelligence`,
 * WITHOUT verifying the receiver is actually the `Intelligence` instance —
 * static analysis cannot reliably trace that binding across parameter
 * passing/destructuring (see the container.ts example in the README, where
 * `Intelligence` arrives as an injected parameter, not a local `const`). A
 * project with an unrelated `.model()` method on some other object, imported
 * from the same file as `@jterrazz/intelligence`, would false-positive here —
 * an accepted, documented limitation of this rule.
 */
export const m1ModelResolutionInContainer: LintRule = {
    create(context: RuleContext): Visitor {
        const file = context.physicalFilename;
        const allowed = isContainerFile(file);

        let importsIntelligence = false;
        const modelCalls: AstNode[] = [];
        const factoryCalls: { name: string; node: AstNode }[] = [];

        return {
            CallExpression(node: AstNode) {
                const callee = node.callee as AstNode | undefined;
                if (callee === undefined) {
                    return;
                }
                if (callee.type === 'Identifier' && FACTORY_NAMES.has(callee.name as string)) {
                    factoryCalls.push({ name: callee.name as string, node });
                    return;
                }
                if (callee.type === 'MemberExpression' && memberPropertyName(callee) === 'model') {
                    const args = (node.arguments as AstNode[] | undefined) ?? [];
                    if (args.length === 1 && stringValue(args[0]) !== undefined) {
                        modelCalls.push(node);
                    }
                }
            },
            ImportDeclaration(node: AstNode) {
                if (stringValue(node.source as AstNode | undefined) === '@jterrazz/intelligence') {
                    importsIntelligence = true;
                }
            },
            'Program:exit'() {
                if (allowed) {
                    return;
                }
                for (const { name, node } of factoryCalls) {
                    context.report({ data: { name }, messageId: 'factoryOutsideContainer', node });
                }
                if (importsIntelligence) {
                    for (const node of modelCalls) {
                        context.report({ messageId: 'modelCallOutsideContainer', node });
                    }
                }
            },
        };
    },
    meta: {
        docs: RULE_DOCS['m1-model-resolution-in-container'],
        messages: {
            factoryOutsideContainer:
                '{{name}}() must only be called from a DI/container file (path containing "/di/" or ending in "container.ts") (M1).',
            modelCallOutsideContainer:
                ".model('…') resolution must only happen in a DI/container file (M1).",
        },
        type: 'problem',
    },
};
