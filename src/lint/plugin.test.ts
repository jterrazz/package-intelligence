import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, test } from 'vitest';

import { RULE_DOCS } from './manifest.js';
import { SELF_RULE_DOCS } from './manifest.self.js';
import plugin, { intelligence, recommendedRules } from './plugin.js';
import type { RuleDoc } from './types.js';

/**
 * Completeness meta-test — mirrors `@jterrazz/test`'s `src/lint/plugin.test.ts`
 * (minus the docs-generation freshness checks: this package has no generated
 * catalogue file to keep in sync, only the manifest itself). Guards:
 *
 * - every shipped rule carries `meta.docs`, sourced from {@link RULE_DOCS};
 * - every row of both manifests declares its audience: `manifest.ts` holds
 *   `consumer` rows alone, `manifest.self.ts` `self` rows alone, and the
 *   published plugin carries only `consumer` rules;
 * - the `consumer` rows cover EXACTLY the shipped rules (no orphan doc, no
 *   undocumented rule), and no `self` row is wired;
 * - the `intelligence` fragment is a complete, standalone oxlint config
 *   fragment (every rule wired, nothing missing);
 * - every rule has an E2E fixture pair (`specs/integration/lint/_fixtures/<id>`
 *   and `<id>-ok`) AND a `RuleTester` spec file (`src/lint/rules/<id>.test.ts`).
 */
const ROOT = resolve(import.meta.dirname, '../..');

/** The manifest read by an arbitrary id — what a shipped rule id is, is the subject under test. */
const docsById: Record<string, RuleDoc> = RULE_DOCS;

const selfDocsById: Record<string, RuleDoc> = SELF_RULE_DOCS;

/** Both manifests, each row tagged with the file that holds it. */
const allRows: { doc: RuleDoc; file: 'manifest.self.ts' | 'manifest.ts'; key: string }[] = [
    ...Object.entries(RULE_DOCS).map(([key, doc]) => ({ doc, file: 'manifest.ts' as const, key })),
    ...Object.entries(selfDocsById).map(([key, doc]) => ({
        doc,
        file: 'manifest.self.ts' as const,
        key,
    })),
];

const pluginRules = new Set(Object.keys(plugin.rules));

describe('rule manifest — completeness (meta-test)', () => {
    test('every shipped plugin rule carries a meta.docs entry from the manifest', () => {
        // Given - each shipped intelligence/* rule
        for (const [id, rule] of Object.entries(plugin.rules)) {
            // Then - it attaches its manifest doc as meta.docs
            expect(rule.meta?.docs, `rule ${id} is missing meta.docs`).toBeDefined();
            expect(rule.meta?.docs).toBe(docsById[id]);
        }
    });

    test('the consumer rows of both manifests cover exactly the shipped plugin rules', () => {
        // Given - every consumer row, whichever manifest holds it, and the plugin map
        const consumerIds = allRows
            .filter(({ doc }) => doc.audience === 'consumer')
            .map(({ key }) => key);

        // Then - the two sets are identical (no orphan doc, no undocumented rule)
        expect(consumerIds.toSorted()).toStrictEqual([...pluginRules].toSorted());
    });

    test('every rule id and name is unique across both manifests', () => {
        // Given - every row of both manifests
        const seen = new Set<string>();
        for (const { doc, key } of allRows) {
            // Then - neither its id nor its name has been seen before
            expect(seen.has(doc.id), `duplicate manifest id ${doc.id}`).toBe(false);
            expect(seen.has(key), `duplicate manifest name ${key}`).toBe(false);
            seen.add(doc.id);
            seen.add(key);
        }
    });
});

describe('rule audience (meta-test)', () => {
    const AUDIENCES: ReadonlySet<string> = new Set(['consumer', 'self']);

    test('every manifest row declares an audience from the closed set', () => {
        // Given - every row of both manifests
        for (const { doc, key } of allRows) {
            // Then - it names `consumer` or `self`, and nothing else
            expect(AUDIENCES.has(doc.audience), `${key} declares no known audience`).toBe(true);
        }
    });

    test('each manifest holds the rows of one audience', () => {
        // Given - every row of both manifests
        for (const { doc, file, key } of allRows) {
            // Then - the published manifest holds consumer rows, the home-only one self rows
            expect(doc.audience, `${key} sits in ${file}`).toBe(
                file === 'manifest.ts' ? 'consumer' : 'self',
            );
        }
    });

    test('the published plugin carries only consumer rules', () => {
        // Given - each rule the `./oxlint` entry ships
        for (const [id, rule] of Object.entries(plugin.rules)) {
            // Then - it speaks to a consumer project, never to this package's own suite
            expect(rule.meta?.docs?.audience, `${id} is not a consumer rule`).toBe('consumer');
        }
    });
});

describe('intelligence fragment — standalone oxlint config', () => {
    test('is self-sufficient: plugin + every rule, no `extends` needed', () => {
        // Given - a consumer composing @jterrazz/typescript/oxlint with this fragment
        // Then - it registers the tool-facing plugin and enables every shipped rule
        expect(intelligence.jsPlugins).toContain('@jterrazz/intelligence/oxlint');
        expect(intelligence.rules).toBe(recommendedRules);
        expect(Object.keys(intelligence.rules)).toStrictEqual(
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
            expect(severity).toBe(/^\w+w-/u.test(id) ? 'warn' : 'error');
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
            expect(existsSync(resolve(ROOT, 'specs/integration/lint/_fixtures', id))).toBe(true);
            expect(existsSync(resolve(ROOT, 'specs/integration/lint/_fixtures', `${id}-ok`))).toBe(
                true,
            );
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
            resolve(ROOT, 'specs/integration/lint/_fixtures/oxlint.e2e.json'),
            'utf8',
        );
        const config = JSON.parse(raw) as { rules: Record<string, unknown> };

        // Then - its rule keys match recommendedRules exactly
        expect(Object.keys(config.rules).toSorted()).toStrictEqual(
            Object.keys(recommendedRules).toSorted(),
        );
    });
});
