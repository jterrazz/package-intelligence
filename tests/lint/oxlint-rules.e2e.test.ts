import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { describe, expect, test } from 'vitest';

/**
 * End-to-end lint layer — runs the REAL oxlint binary with the built
 * `@jterrazz/intelligence/oxlint` plugin loaded (`dist/oxlint.js`) against
 * each rule's violation/compliant fixture pair, mirroring `@jterrazz/test`'s
 * `specs/lint/files/*.test.ts` (E2E through the actual tool, not just
 * `RuleTester`). Requires `npm run build` first — oxlint's JS-plugin loader
 * needs a JS module, and the same caveat `@jterrazz/test` documents applies:
 * Node's type-stripping is not relied upon for the plugin entry, so it always
 * loads from `dist/`, never from `src/lint/plugin.ts` directly.
 */

const ROOT = resolve(import.meta.dirname, '../..');
const OXLINT_BIN = resolve(ROOT, 'node_modules/.bin/oxlint');
const CONFIG = resolve(ROOT, 'tests/lint-fixtures/lint-violations/oxlint.e2e.json');
const FIXTURES = resolve(ROOT, 'tests/lint-fixtures/lint-violations');

type Severity = 'error' | 'warn';

type RunResult = { exitCode: number; stdout: string };

function runOxlint(target: string): RunResult {
    try {
        const stdout = execFileSync(OXLINT_BIN, ['--config', CONFIG, target], {
            cwd: ROOT,
            encoding: 'utf8',
        });
        return { exitCode: 0, stdout };
    } catch (error) {
        const execError = error as { status?: number; stdout?: string };
        return { exitCode: execError.status ?? 1, stdout: execError.stdout ?? '' };
    }
}

const RULES: { id: string; severity: Severity }[] = [
    { id: 'g1-agent-class-shape', severity: 'error' },
    { id: 'm1-model-resolution-in-container', severity: 'error' },
    { id: 'm2w-no-hardcoded-model-id', severity: 'warn' },
    { id: 'p1-prose-in-prompt-files', severity: 'error' },
    { id: 'p2-prompt-file-exports', severity: 'error' },
    { id: 'p3-agent-prompt-sibling', severity: 'error' },
];

describe('oxlint preset — E2E (real oxlint binary + built dist/oxlint.js)', () => {
    for (const { id, severity } of RULES) {
        describe(id, () => {
            // Scalpel: a targeted rule-id presence/absence probe, not a full-output
            // Snapshot — a snapshot would couple this test to oxlint's diagnostic
            // Formatting instead of to what THIS plugin actually reports.
            test(`rejects the ${id} violation fixture`, () => {
                // Given - a project violating the rule
                const result = runOxlint(resolve(FIXTURES, id));

                // Then - oxlint reports the diagnostic under this plugin's rule id
                expect(result.stdout).toContain(`intelligence(${id})`);
                if (severity === 'error') {
                    expect(result.exitCode).toBe(1);
                }
            });

            test(`accepts the ${id} compliant fixture`, () => {
                // Given - the compliant twin
                const result = runOxlint(resolve(FIXTURES, `${id}-ok`));

                // Then - clean run, no diagnostic under this plugin's rule id
                expect(result.exitCode).toBe(0);
                expect(result.stdout).not.toContain(`intelligence(${id})`);
            });
        });
    }
});
