import { execFileSync } from 'node:child_process';
import { cpSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { expect, test } from 'vitest';

import { integration } from '../integration.specification.js';

/**
 * The plugin as oxlint actually loads it: the REAL binary, the BUILT
 * `dist/oxlint.js`, and each rule's violation/compliant fixture pair. oxlint's
 * JS-plugin loader takes a JS module, so `npm run build` precedes this spec.
 */
const ROOT = resolve(import.meta.dirname, '../../..');
const OXLINT_BIN = resolve(ROOT, 'node_modules/.bin/oxlint');
const CONFIG = resolve(import.meta.dirname, '_fixtures/oxlint.e2e.json');
const FIXTURES = resolve(import.meta.dirname, '_fixtures');

type Severity = 'error' | 'warn';

type RunResult = { exitCode: number; stdout: string };

/**
 * A fixture stands for a CONSUMER's repository, so it is linted from a
 * directory of its own. Several rules exempt a path carrying a `specs`,
 * `fixtures` or `config` segment, and this package's own spec tree would
 * otherwise answer for the tree under test.
 */
function lintFixture(name: string): RunResult {
    const workdir = mkdtempSync(join(tmpdir(), 'intelligence-lint-'));
    try {
        cpSync(resolve(FIXTURES, name), workdir, { recursive: true });
        const stdout = execFileSync(OXLINT_BIN, ['--config', CONFIG, workdir], {
            cwd: ROOT,
            encoding: 'utf8',
        });
        return { exitCode: 0, stdout };
    } catch (error) {
        const execError = error as { status?: number; stdout?: string };
        return { exitCode: execError.status ?? 1, stdout: execError.stdout ?? '' };
    } finally {
        rmSync(workdir, { force: true, recursive: true });
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

// Scalpel over snapshot (D11 exception d): the assertion is the rule id THIS
// plugin reports, never oxlint's diagnostic formatting, which is a third
// party's to change.
test.each(RULES)('$id rejects its violation fixture', async ({ id, severity }) => {
    // Given - the fixture project that breaks the rule
    const result = await integration.call(() => lintFixture(id));

    // Then - oxlint reports the diagnostic, and an error-severity rule fails the run
    expect(result.value.value.stdout).toContain(`intelligence(${id})`);
    expect(result.value.value.exitCode).toBe(severity === 'error' ? 1 : 0);
});

test.each(RULES)('$id accepts its compliant fixture', async ({ id }) => {
    // Given - the compliant twin of that fixture
    const result = await integration.call(() => lintFixture(`${id}-ok`));

    // Then - a clean run, with no diagnostic under this plugin's rule id
    expect(result.value.value.exitCode).toBe(0);
    expect(result.value.value.stdout).not.toContain(`intelligence(${id})`);
});
