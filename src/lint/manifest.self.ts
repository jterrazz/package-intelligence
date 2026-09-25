import type { SelfRuleDoc } from './types.js';

/** The closed set of `self` rule ids — none today. */
type SelfRuleId = never;

/**
 * The `self` rows of the rule manifest: rules that only make sense against
 * this package's own tree. No module a tsdown entry bundles imports this one,
 * so no row of it reaches `dist/`; the tarball spec greps the packed package
 * for every row's id, name and convention to hold that.
 */
export const SELF_RULE_DOCS: Record<SelfRuleId, SelfRuleDoc> = {};
