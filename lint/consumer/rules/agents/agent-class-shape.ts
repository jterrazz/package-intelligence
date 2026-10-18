import { defineRule, readAt, rowNamed } from '@jterrazz/typescript/rules';

import { detectAgentFile } from '../../../kit/project/agents.js';
import { child, childList, identifierName } from '../../../kit/project/ast.js';
import type { AstNode, RuleContext, Visitor } from '../../../kit/project/rule.js';
import { CATALOGUE_CHAPTER } from '../../catalogue/chapter.js';
import { consumerRows } from '../../catalogue/manifest.js';

function parameterName(param: AstNode | undefined): string | undefined {
    if (param?.type === 'TSParameterProperty') {
        return parameterName(child(param, 'parameter'));
    }
    if (param?.type === 'AssignmentPattern') {
        return parameterName(child(param, 'left'));
    }
    return identifierName(param);
}

function memberNamed(
    members: AstNode[],
    types: readonly string[],
    name: string,
): AstNode | undefined {
    return members.find(
        (member) => types.includes(member.type) && identifierName(child(member, 'key')) === name,
    );
}

const CLASSES = new Set(['ClassDeclaration', 'ClassExpression']);

function exportedClass(node: AstNode): AstNode | undefined {
    const declaration = child(node, 'declaration');
    return CLASSES.has(String(declaration?.type)) ? declaration : undefined;
}

function judgeClass(context: RuleContext, target: AstNode): void {
    const members = childList(child(target, 'body'), 'body');
    const schema = memberNamed(members, ['PropertyDefinition'], 'SCHEMA');
    if (schema?.static !== true) {
        context.report({ messageId: 'missingSchema', node: target });
    }
    if (memberNamed(members, ['MethodDefinition', 'PropertyDefinition'], 'run') === undefined) {
        context.report({ messageId: 'missingRun', node: target });
    }
    const constructor = memberNamed(members, ['MethodDefinition'], 'constructor');
    if (constructor === undefined) {
        context.report({ messageId: 'missingConstructorModel', node: target });
        return;
    }
    const firstParam = childList(child(constructor, 'value'), 'params')[0];
    if (parameterName(firstParam) !== 'model') {
        context.report({ messageId: 'missingConstructorModel', node: firstParam ?? constructor });
    }
}

const row = rowNamed(consumerRows, 'agent-class-shape');

export const agentClassShape = defineRule(
    {
        docs: row,
        messages: {
            missingConstructorModel: {
                fix: 'name the first constructor parameter `model`, the language model the composition root hands it',
                found: "the agent class's constructor takes no `model` first",
            },
            missingRun: {
                fix: 'give the class its `run` method, the one call its users make',
                found: 'the agent class has no `run` method',
            },
            missingSchema: {
                fix: 'declare the output schema as `static readonly SCHEMA`',
                found: 'the agent class has no `static readonly SCHEMA`',
            },
            multipleExportedClasses: {
                fix: 'keep one class per agent file, and move the other to a file of its own',
                found: 'the agent file exports a second class',
            },
            noExportedClass: {
                fix: 'export the agent class from its file',
                found: 'the agent file exports no class',
            },
        },
        read: readAt(row, CATALOGUE_CHAPTER),
    },
    {
        create(context: RuleContext): Visitor {
            if (detectAgentFile(context.physicalFilename) === undefined) {
                return {};
            }
            const exportedClasses: AstNode[] = [];
            const collect = (node: AstNode): void => {
                const declared = exportedClass(node);
                if (declared !== undefined) {
                    exportedClasses.push(declared);
                }
            };
            return {
                ExportDefaultDeclaration: collect,
                ExportNamedDeclaration: collect,
                'Program:exit'(node: AstNode) {
                    const [target, ...extras] = exportedClasses;
                    if (target === undefined) {
                        context.report({ messageId: 'noExportedClass', node });
                        return;
                    }
                    for (const extra of extras) {
                        context.report({ messageId: 'multipleExportedClasses', node: extra });
                    }
                    judgeClass(context, target);
                },
            };
        },
    },
);
