import { defineRule, readAt, rowNamed } from '@jterrazz/typescript/rules';

import {
    child,
    childList,
    identifierName,
    memberPropertyName,
    stringValue,
} from '../../../kit/project/ast.js';
import { isTestMaterial } from '../../../kit/project/paths.js';
import type { AstNode, RuleContext, Visitor } from '../../../kit/project/rule.js';
import { CATALOGUE_CHAPTER } from '../../catalogue/chapter.js';
import { consumerRows } from '../../catalogue/manifest.js';

const FACTORY_NAMES = new Set([
    'createGatewayProvider',
    'createIntelligence',
    'createOpenRouterProvider',
]);

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
            const modelCalls: AstNode[] = [];
            return {
                CallExpression(node: AstNode) {
                    const name = identifierName(child(node, 'callee'));
                    if (name !== undefined && FACTORY_NAMES.has(name)) {
                        context.report({
                            data: { name },
                            messageId: 'factoryOutsideComposition',
                            node,
                        });
                    } else if (isLiteralModelCall(node)) {
                        modelCalls.push(node);
                    }
                },
                ImportDeclaration(node: AstNode) {
                    if (stringValue(child(node, 'source')) === '@jterrazz/intelligence') {
                        importsIntelligence = true;
                    }
                },
                'Program:exit'() {
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
