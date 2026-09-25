import { execFileSync } from 'node:child_process';
import { mkdirSync, readdirSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, test } from 'vitest';

import { RULE_DOCS } from './manifest.js';
import { SELF_RULE_DOCS } from './manifest.self.js';
import type { RuleDoc } from './types.js';

/**
 * No `self` row ships, judged by CONTENT: the package is packed as npm
 * publishes it, and the text of every file of the tarball is searched for
 * the name, quoted id and convention of every `self` row of either manifest — whichever bundle,
 * entry, map or declaration file would carry it. The tarball carries the
 * BUILT `dist/`, so `npm run build` precedes this test.
 */
const ROOT = resolve(import.meta.dirname, '../..');
const PACKED = resolve(ROOT, '.artifacts/tarball-text');

/** The concatenated text of every file of the tarball `npm pack` writes. */
function packedText(): string {
    rmSync(PACKED, { force: true, recursive: true });
    mkdirSync(PACKED, { recursive: true });
    execFileSync('npm', ['pack', '--ignore-scripts', '--pack-destination', PACKED], {
        cwd: ROOT,
        stdio: 'ignore',
    });
    const tarball = readdirSync(PACKED).find((file) => file.endsWith('.tgz'));
    if (tarball === undefined) {
        throw new Error('npm pack wrote no tarball');
    }
    return execFileSync('tar', ['-xzOf', resolve(PACKED, tarball)], {
        encoding: 'utf8',
        maxBuffer: 64 * 1024 * 1024,
    });
}

function escaped(text: string): string {
    return text.replaceAll(/[$()*+.?[\\\]^{|}]/gu, String.raw`\$&`);
}

/** How a manifest row surfaces in shipped text: its name, its quoted id, its convention. */
function tracesOf(name: string, doc: RuleDoc): RegExp[] {
    return [
        new RegExp(escaped(name), 'u'),
        new RegExp(String.raw`["'\x60]${escaped(doc.id)}\\?["'\x60]`, 'u'),
        new RegExp(escaped(doc.convention), 'u'),
    ];
}

const text = packedText();
const selfDocsById: Record<string, RuleDoc> = SELF_RULE_DOCS;

/** Every row of both manifests — a `self` row filed in the wrong one is still searched. */
const rows: [string, RuleDoc][] = [...Object.entries(RULE_DOCS), ...Object.entries(selfDocsById)];

function rowsOf(audience: RuleDoc['audience']): [string, RuleDoc][] {
    return rows.filter(([, doc]) => doc.audience === audience);
}

describe('the self manifest — never shipped (meta-test)', () => {
    test('no file of the tarball names a self row', () => {
        // Given - every self row of either manifest, and the text of every packed file
        const leaks = rowsOf('self').flatMap(([name, doc]) =>
            tracesOf(name, doc)
                .filter((trace) => trace.test(text))
                .map((trace) => `${name} ships (${String(trace)})`),
        );

        // Then - no packed file carries a self row's name, quoted id or convention
        expect(leaks).toStrictEqual([]);
    });

    test('the same search finds every consumer row in the tarball', () => {
        // Given - every consumer row, searched the way a self row is
        for (const [name, doc] of rowsOf('consumer')) {
            for (const trace of tracesOf(name, doc)) {
                // Then - it is found, so the search reads the shipped text
                expect(trace.test(text), `${name} not found by ${String(trace)}`).toBe(true);
            }
        }
    });
});
