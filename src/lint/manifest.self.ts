import type { SelfRuleDoc } from './types.js';

/** The closed set of `self` rule ids — none today. */
type SelfRuleId = never;

/**
 * The `self` rows of the rule manifest: rules that only make sense against
 * this package's own tree. No module a tsdown entry bundles imports this one,
 * so no row of it reaches `dist/`; `manifest.self.test.ts` searches the packed
 * tarball for every row's name, quoted id and convention to hold that.
 */
export const SELF_RULE_DOCS: Record<SelfRuleId, SelfRuleDoc> = {};
