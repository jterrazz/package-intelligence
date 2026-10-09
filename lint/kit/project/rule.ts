// outside: oxlint exports no `Context` or node types, so the subset these rules read is written here.

export type AstNode = {
    [key: string]: unknown;
    type: string;
};

export type RuleContext = {
    physicalFilename: string;
    report: (diagnostic: {
        data?: Record<string, number | string>;
        messageId: string;
        node: AstNode;
    }) => void;
    sourceCode: { text: string };
};

export type Visitor = Record<string, (node: AstNode) => void>;

export type LintRule = {
    create: (context: RuleContext) => Visitor;
    meta: { docs: { name: string } };
};

export type LintPlugin = {
    meta: { name: string };
    rules: Record<string, LintRule>;
};
