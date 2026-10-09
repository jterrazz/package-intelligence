import { defineRule, readAt, rowNamed } from '@jterrazz/typescript/rules';

import {
    child,
    childList,
    identifierName,
    memberPropertyName,
    stringValue,
    textOf,
} from '../../../kit/project/ast.js';
import { isTestMaterial } from '../../../kit/project/paths.js';
import type { AstNode, RuleContext, Visitor } from '../../../kit/project/rule.js';
import { CATALOGUE_CHAPTER } from '../../catalogue/chapter.js';
import { consumerRows } from '../../catalogue/manifest.js';

const FACTORY_NAMES = new Set<string | undefined>([
    'createGatewayProvider',
    'createIntelligence',
    'createOpenRouterProvider',
]);

const PACKAGE = '@jterrazz/intelligence';

function isFactoryName(name: string | undefined): name is string {
    return FACTORY_NAMES.has(name);
}

function recordImport(
    specifier: AstNode,
    factories: Map<string | undefined, string>,
    namespaces: Set<string | undefined>,
): void {
    const local = identifierName(child(specifier, 'local'));
    if (textOf(specifier, 'type') === 'ImportNamespaceSpecifier') {
        namespaces.add(local);
        return;
    }
    const imported = identifierName(child(specifier, 'imported'));
    if (isFactoryName(imported)) {
        factories.set(local, imported);
    }
}

function factoryCalled(
    callee: AstNode | undefined,
    factories: Map<string | undefined, string>,
    namespaces: Set<string | undefined>,
): string | undefined {
    const local = identifierName(callee);
    if (local !== undefined) {
        return factories.get(local);
    }
    const receiver = identifierName(child(callee, 'object'));
    const member = memberPropertyName(callee);
    return namespaces.has(receiver) && isFactoryName(member) ? member : undefined;
}

function isLiteralModelCall(node: AstNode): boolean {
    const args = childList(node, 'arguments');
    return (
        memberPropertyName(child(node, 'callee')) === 'model' &&
        args.length === 1 &&
        stringValue(args[0]) !== undefined
    );
}

const row = rowNamed(consumerRows, 'model-resolution-in-composition');

// outside: the `.model()` receiver is never resolved, so an unrelated literal `.model()` in a file importing the package is a known false positive.
export const modelResolutionInComposition = defineRule(
    {
        docs: row,
        messages: {
            factoryOutsideComposition: {
                fix: 'call `{{name}}()` from a file under `composition/`, and hand what it builds to the code that needs it',
                found: '`{{name}}()` is called outside the composition root',
            },
            modelCallOutsideComposition: {
                fix: 'resolve the model in a file under `composition/`, and hand the model on',
                found: "`.model('…')` resolves a model outside the composition root",
            },
        },
        read: readAt(row, CATALOGUE_CHAPTER),
    },
    {
        create(context: RuleContext): Visitor {
            const file = context.physicalFilename;
            if (file.includes('/composition/') || isTestMaterial(file)) {
                return {};
            }
            let importsIntelligence = false;
            const factories = new Map<string | undefined, string>();
            const namespaces = new Set<string | undefined>();
            // Stryker disable next-line ArrayDeclaration: a seeded entry is no node, so factoryCalled finds no factory in it and nothing is reported
            const factoryCalls: AstNode[] = [];
            const modelCalls: AstNode[] = [];
            return {
                CallExpression(node: AstNode) {
                    if (isLiteralModelCall(node)) {
                        modelCalls.push(node);
                    } else {
                        factoryCalls.push(node);
                    }
                },
                ImportDeclaration(node: AstNode) {
                    if (stringValue(child(node, 'source')) !== PACKAGE) {
                        return;
                    }
                    importsIntelligence = true;
                    for (const specifier of childList(node, 'specifiers')) {
                        recordImport(specifier, factories, namespaces);
                    }
                },
                'Program:exit'() {
                    for (const node of factoryCalls) {
                        const name = factoryCalled(child(node, 'callee'), factories, namespaces);
                        if (name !== undefined) {
                            context.report({
                                data: { name },
                                messageId: 'factoryOutsideComposition',
                                node,
                            });
                        }
                    }
                    if (!importsIntelligence) {
                        return;
                    }
                    for (const node of modelCalls) {
                        context.report({ messageId: 'modelCallOutsideComposition', node });
                    }
                },
            };
        },
    },
);
