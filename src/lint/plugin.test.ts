import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, test } from 'vitest';

import { RULE_DOCS } from './manifest.js';
import plugin, { intelligence, recommendedRules } from './plugin.js';

/**
 * Completeness meta-test — mirrors `@jterrazz/test`'s `src/lint/plugin.test.ts`
 * (minus the docs-generation freshness checks: this package has no generated
 * catalogue file to keep in sync, only the manifest itself). Guards:
 *
 * - every shipped rule carries `meta.docs`, sourced from {@link RULE_DOCS};
 * - the manifest covers EXACTLY the shipped rules (no orphan doc, no
 *   undocumented rule);
 * - the `intelligence` fragment is a complete, standalone oxlint config
 *   fragment (every rule wired, nothing missing);
 * - every rule has an E2E fixture pair (`tests/lint-fixtures/lint-violations/<id>`
 *   and `<id>-ok`) AND a `RuleTester` spec file (`src/lint/rules/<id>.test.ts`).
 */
const ROOT = resolve(import.meta.dirname, '../..');

const pluginRules = new Set(Object.keys(plugin.rules));

describe('rule manifest — completeness (meta-test)', () => {
    test('every shipped plugin rule carries a meta.docs entry from the manifest', () => {
        // Given - each shipped intelligence/* rule
        for (const [id, rule] of Object.entries(plugin.rules)) {
            // Then - it attaches its manifest doc as meta.docs
            expect(rule.meta?.docs, `rule ${id} is missing meta.docs`).toBeDefined();
            expect(rule.meta?.docs).toBe(RULE_DOCS[id]);
        }
    });

    test('the manifest covers exactly the shipped plugin rules', () => {
        // Given - the manifest and the plugin map
        // Then - the two sets are identical (no orphan doc, no undocumented rule)
        expect(Object.keys(RULE_DOCS).sort()).toEqual([...pluginRules].sort());
    });

    test('every rule id is unique across the manifest', () => {
        const ids = new Set<string>();
        for (const doc of Object.values(RULE_DOCS)) {
            expect(ids.has(doc.id), `duplicate manifest id ${doc.id}`).toBe(false);
            ids.add(doc.id);
        }
    });
});

describe('intelligence fragment — standalone oxlint config', () => {
    test('is self-sufficient: plugin + every rule, no `extends` needed', () => {
        // Given - a consumer composing @jterrazz/typescript/oxlint with this fragment
        // Then - it registers the tool-facing plugin and enables every shipped rule
        expect(intelligence.jsPlugins).toContain('@jterrazz/intelligence/oxlint');
        expect(intelligence.rules).toBe(recommendedRules);
        expect(Object.keys(intelligence.rules)).toEqual(
            Object.keys(plugin.rules).map((id) => `intelligence/${id}`),
        );
        // The fragment carries no `extends` — it's additive, composed via `compose()`.
        expect('extends' in intelligence).toBe(false);
    });

    test('severities follow the `<id>w-*` warning convention', () => {
        // Given - the recommended severities
        for (const [key, severity] of Object.entries(recommendedRules)) {
            const id = key.replace('intelligence/', '');
            // Then - only `<letter><digit>w-*` ids are warnings, the rest are errors
            expect(severity).toBe(/^\w+w-/.test(id) ? 'warn' : 'error');
        }
    });
});

describe('rule catalogue — E2E inventory (meta-test)', () => {
    const ruleTestFiles = new Set(
        readdirSync(resolve(ROOT, 'src/lint/rules'))
            .filter((entry) => entry.endsWith('.test.ts'))
            .map((entry) => entry.slice(0, -'.test.ts'.length)),
    );

    test('every plugin rule has a RuleTester spec file and an E2E fixture pair', () => {
        // Given - each shipped rule
        for (const id of pluginRules) {
            // Then - its unit spec and its violation/compliant fixture twin exist
            expect(ruleTestFiles.has(id), `${id} has no src/lint/rules/${id}.test.ts`).toBe(true);
            expect(existsSync(resolve(ROOT, 'tests/lint-fixtures/lint-violations', id))).toBe(true);
            expect(
                existsSync(resolve(ROOT, 'tests/lint-fixtures/lint-violations', `${id}-ok`)),
            ).toBe(true);
        }
    });

    test('every RuleTester spec file maps to a shipped rule', () => {
        // Given - each src/lint/rules/*.test.ts file
        for (const id of ruleTestFiles) {
            // Then - it names a rule the plugin actually ships
            expect(pluginRules.has(id), `${id}.test.ts has no matching plugin rule`).toBe(true);
        }
    });

    test('the E2E oxlint config enables exactly the shipped rule set', () => {
        // Given - the standalone oxlint config the E2E spec lints fixtures with
        const raw = readFileSync(
            resolve(ROOT, 'tests/lint-fixtures/lint-violations/oxlint.e2e.json'),
            'utf8',
        );
        const config = JSON.parse(raw) as { rules: Record<string, unknown> };

        // Then - its rule keys match recommendedRules exactly
        expect(Object.keys(config.rules).sort()).toEqual(Object.keys(recommendedRules).sort());
    });
});
