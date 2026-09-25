// oxlint exports no `Plugin`/`Rule`/`Context` types, so the subset this layer uses is described here.

export type AstNode = {
    type: string;
    [key: string]: unknown;
};

export type SourceCode = {
    text: string;
};

export type Diagnostic = {
    data?: Record<string, number | string>;
    messageId?: string;
    message?: string;
    node?: AstNode;
};

export type RuleContext = {
    filename: string;
    id: string;
    options: readonly unknown[];
    physicalFilename: string;
    report: (diagnostic: Diagnostic) => void;
    sourceCode: SourceCode;
};

export type Visitor = Record<string, (node: AstNode) => void>;

export type RuleAudience = 'consumer' | 'self';

export type RuleDoc = {
    audience: RuleAudience;
    id: string;
    convention: string;
    rationale: string;
};

export type ConsumerRuleDoc = RuleDoc & { audience: 'consumer' };

export type SelfRuleDoc = RuleDoc & { audience: 'self' };

export type RuleMeta = {
    docs?: RuleDoc & { description?: string };
    messages?: Record<string, string>;
    // oxlint requires a schema for a rule that takes options.
    schema?: false | unknown[];
    type?: 'layout' | 'problem' | 'suggestion';
};

export type LintRule = {
    create: (context: RuleContext) => Visitor;
    meta?: RuleMeta;
};

export type LintPlugin = {
    meta: { name: string };
    rules: Record<string, LintRule>;
};

export type LintSeverity = 'error' | 'warn';

export type LintFragment = {
    jsPlugins: string[];
    rules: Record<string, LintSeverity>;
};
