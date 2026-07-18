/**
 * Local structural types for the slice of oxlint's JS-plugin API this layer uses.
 *
 * oxlint does not publicly export its `Plugin` / `Rule` / `Context` types (only
 * `RuleTester`, from `oxlint/plugins-dev`), so we describe the exact subset we
 * depend on here. Declaring them locally keeps the rules layer importing
 * NOTHING but these ambient shapes and pure helpers from `ast.ts`/`fs.ts` — no
 * dependency on the AI SDK / `ai` runtime this package otherwise ships, so the
 * oxlint bundle stays light. The API is ESLint-compatible, so these shapes
 * mirror ESTree (mirrors `@jterrazz/test`'s `src/lint/types.ts`).
 */

/** Minimal AST node. Rules narrow by `type` and read known fields defensively. */
export type AstNode = {
    type: string;
    [key: string]: unknown;
};

/** The slice of `context.sourceCode` the rules read. */
export type SourceCode = {
    text: string;
};

/** A diagnostic accepted by `context.report`. */
export type Diagnostic = {
    data?: Record<string, number | string>;
    messageId?: string;
    message?: string;
    node?: AstNode;
};

/** Rule context passed to `create`. */
export type RuleContext = {
    filename: string;
    id: string;
    /** Configured rule options (`['error', …options]` minus the severity). */
    options: readonly unknown[];
    physicalFilename: string;
    report: (diagnostic: Diagnostic) => void;
    sourceCode: SourceCode;
};

/** A visitor: node-type keys → handlers invoked on entry (plus `Program:exit`). */
export type Visitor = Record<string, (node: AstNode) => void>;

/**
 * The normative documentation a rule carries — the code is the source of truth
 * for the mechanized catalogue (docs-as-code inversion, mirroring
 * `@jterrazz/test`). Every plugin rule sets `meta.docs` to its {@link RuleDoc}
 * entry from `manifest.ts`; `plugin.test.ts` guards that every shipped rule
 * carries one and that the manifest covers exactly the shipped rules.
 */
export type RuleDoc = {
    /** Convention code, e.g. `'P1'`. */
    id: string;
    /** The normative sentence — what the rule enforces. */
    convention: string;
    /** One line: why the rule exists. */
    rationale: string;
};

/** Rule metadata (the subset we set). */
export type RuleMeta = {
    docs?: RuleDoc & { description?: string };
    messages?: Record<string, string>;
    /** JSON schema for options — required by oxlint for rules that take options. */
    schema?: false | unknown[];
    type?: 'layout' | 'problem' | 'suggestion';
};

/** A lint rule in oxlint's `create` form. */
export type LintRule = {
    create: (context: RuleContext) => Visitor;
    meta?: RuleMeta;
};

/** An oxlint JS plugin: a namespace plus its rules. */
export type LintPlugin = {
    meta: { name: string };
    rules: Record<string, LintRule>;
};
