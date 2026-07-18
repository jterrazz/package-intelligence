import { detectAgentFile } from '../agents.js';
import { RULE_DOCS } from '../manifest.js';
import type { AstNode, LintRule, RuleContext, Visitor } from '../types.js';

/** Unwrap `private readonly model: T` (TSParameterProperty) / defaults to the bare identifier. */
function parameterName(param: AstNode | undefined): string | undefined {
    if (param === undefined) {
        return undefined;
    }
    if (param.type === 'Identifier') {
        return param.name as string;
    }
    if (param.type === 'TSParameterProperty') {
        return parameterName(param.parameter as AstNode | undefined);
    }
    if (param.type === 'AssignmentPattern') {
        return parameterName(param.left as AstNode | undefined);
    }
    return undefined;
}

function classBody(classNode: AstNode): AstNode[] {
    const body = classNode.body as AstNode | undefined;
    return (body?.body as AstNode[] | undefined) ?? [];
}

/**
 * CONVENTIONS G1 — an agent file's class shape: exactly one exported class,
 * carrying a `static readonly SCHEMA` member, a `run` method, and a
 * constructor whose first parameter is `model` (the `LanguageModel` the
 * class's `run()` passes straight to `generateText`/`streamText`).
 */
export const g1AgentClassShape: LintRule = {
    create(context: RuleContext): Visitor {
        const file = context.physicalFilename;
        if (detectAgentFile(file) === undefined) {
            return {};
        }

        const exportedClasses: AstNode[] = [];

        return {
            ExportDefaultDeclaration(node: AstNode) {
                const declaration = node.declaration as AstNode | undefined;
                if (
                    declaration?.type === 'ClassDeclaration' ||
                    declaration?.type === 'ClassExpression'
                ) {
                    exportedClasses.push(declaration);
                }
            },
            ExportNamedDeclaration(node: AstNode) {
                const declaration = node.declaration as AstNode | undefined;
                if (declaration?.type === 'ClassDeclaration') {
                    exportedClasses.push(declaration);
                }
            },
            'Program:exit'(node: AstNode) {
                if (exportedClasses.length === 0) {
                    context.report({ messageId: 'noExportedClass', node });
                    return;
                }
                if (exportedClasses.length > 1) {
                    for (const extra of exportedClasses.slice(1)) {
                        context.report({ messageId: 'multipleExportedClasses', node: extra });
                    }
                }

                const target = exportedClasses[0];
                const members = classBody(target);

                const hasSchema = members.some((member) => {
                    if (member.type !== 'PropertyDefinition' || member.static !== true) {
                        return false;
                    }
                    const key = member.key as AstNode | undefined;
                    return key?.type === 'Identifier' && key.name === 'SCHEMA';
                });
                if (!hasSchema) {
                    context.report({ messageId: 'missingSchema', node: target });
                }

                const hasRun = members.some((member) => {
                    if (
                        member.type !== 'MethodDefinition' &&
                        member.type !== 'PropertyDefinition'
                    ) {
                        return false;
                    }
                    const key = member.key as AstNode | undefined;
                    return key?.type === 'Identifier' && key.name === 'run';
                });
                if (!hasRun) {
                    context.report({ messageId: 'missingRun', node: target });
                }

                const constructor = members.find(
                    (member) =>
                        member.type === 'MethodDefinition' &&
                        (member.kind === 'constructor' ||
                            (member.key as AstNode | undefined)?.name === 'constructor'),
                );
                if (constructor === undefined) {
                    context.report({ messageId: 'missingConstructorModel', node: target });
                    return;
                }
                const value = constructor.value as AstNode | undefined;
                const firstParam = (value?.params as AstNode[] | undefined)?.[0];
                if (parameterName(firstParam) !== 'model') {
                    context.report({
                        messageId: 'missingConstructorModel',
                        node: firstParam ?? constructor,
                    });
                }
            },
        };
    },
    meta: {
        docs: RULE_DOCS['g1-agent-class-shape'],
        messages: {
            missingConstructorModel:
                "Agent class constructor's first parameter must be named `model` (G1).",
            missingRun: 'Agent class is missing a `run` method (G1).',
            missingSchema: 'Agent class is missing a `static readonly SCHEMA` member (G1).',
            multipleExportedClasses: 'Agent file exports more than one class — exactly one (G1).',
            noExportedClass: 'Agent file exports no class — exactly one is required (G1).',
        },
        type: 'problem',
    },
};
