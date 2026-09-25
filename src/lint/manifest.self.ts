import type { SelfRuleDoc } from './types.js';

type SelfRuleId = never;

// No tsdown entry reaches this file, so none of its rows ships.
export const SELF_RULE_DOCS: Record<SelfRuleId, SelfRuleDoc> = {};
