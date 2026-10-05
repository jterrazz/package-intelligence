import { memberPropertyName, stringValue } from '../ast.js';
import { RULE_DOCS } from '../manifest.js';
import type { AstNode, LintRule, RuleContext, Visitor } from '../types.js';

const FACTORY_NAMES = new Set([
    'createGatewayProvider',
    'createIntelligence',
    'createOpenRouterProvider',
]);

const COMPOSITION_ROOT = '/composition/';

function isCompositionFile(file: string): boolean {
    return file.includes(COMPOSITION_ROOT);
}

// A literal `.model()` call is flagged in any file importing the package, receiver unresolved: an unrelated `.model()` there is a known false positive.
export const m1ModelResolutionInComposition: LintRule = {
    create(context: RuleContext): Visitor {
        const file = context.physicalFilename;
        const allowed = isCompositionFile(file);

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
                    context.report({
                        data: { name },
                        messageId: 'factoryOutsideComposition',
                        node,
                    });
                }
                if (importsIntelligence) {
                    for (const node of modelCalls) {
                        context.report({ messageId: 'modelCallOutsideComposition', node });
                    }
                }
            },
        };
    },
    meta: {
        docs: RULE_DOCS['m1-model-resolution-in-composition'],
        messages: {
            factoryOutsideComposition:
                '{{name}}() must only be called from the composition root, a file under `composition/` (M1).',
            modelCallOutsideComposition:
                ".model('…') resolution must only happen in the composition root, a file under `composition/` (M1).",
        },
        type: 'problem',
    },
};
