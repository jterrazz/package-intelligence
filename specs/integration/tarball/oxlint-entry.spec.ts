import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { expect, test } from 'vitest';

import { integration } from '../integration.specification.js';

/**
 * The plugin as npm publishes it: the file list `npm pack` would put in the
 * tarball, and the `./oxlint` entry loaded from exactly those files. Every
 * rule the tarball exposes is a `consumer` rule. Reads the BUILT `dist/`, so
 * `npm run build` precedes this spec.
 */
const ROOT = resolve(import.meta.dirname, '../../..');

/** One loaded entry, projected to plain data: its rules' audiences and its fragment's rule keys. */
type EntrySurface = {
    audiences: Record<string, unknown>;
    recommended: string[];
};

/** Reads `key` off a value of unknown shape — `undefined` when it is not an object. */
function field(value: unknown, key: string): unknown {
    return typeof value === 'object' && value !== null ? Reflect.get(value, key) : undefined;
}

function entries(value: unknown): [string, unknown][] {
    return typeof value === 'object' && value !== null ? Object.entries(value) : [];
}

function packedFiles(): string[] {
    const parsed: unknown = JSON.parse(
        execFileSync('npm', ['pack', '--dry-run', '--json', '--ignore-scripts'], {
            cwd: ROOT,
            encoding: 'utf8',
        }),
    );
    // Older npm prints an array of packs; npm 12 prints an object keyed by package name.
    const packs: unknown[] = Array.isArray(parsed)
        ? parsed
        : entries(parsed).map(([, value]) => value);
    const [pack] = packs;
    const files = field(pack, 'files');
    return Array.isArray(files) ? files.map((file) => String(field(file, 'path'))) : [];
}

function packagePath(target: unknown): string {
    return String(target).replace(/^\.\//u, '');
}

function oxlintEntry(): { import: string; require: string } {
    const manifest: unknown = JSON.parse(readFileSync(resolve(ROOT, 'package.json'), 'utf8'));
    const entry = field(field(manifest, 'exports'), './oxlint');
    return {
        import: packagePath(field(entry, 'import')),
        require: packagePath(field(entry, 'require')),
    };
}

function surfaceOf(module: unknown): EntrySurface {
    const rules = entries(field(field(module, 'default'), 'rules'));
    return {
        audiences: Object.fromEntries(
            rules.map(([id, rule]) => [id, field(field(field(rule, 'meta'), 'docs'), 'audience')]),
        ),
        recommended: entries(field(module, 'recommendedRules')).map(([key]) => key),
    };
}

async function loadPublished(): Promise<{ entries: EntrySurface[]; files: string[] }> {
    const entry = oxlintEntry();
    const esm: unknown = await import(pathToFileURL(resolve(ROOT, entry.import)).href);
    const cjs: unknown = createRequire(import.meta.url)(resolve(ROOT, entry.require));
    return { entries: [surfaceOf(esm), surfaceOf(cjs)], files: packedFiles() };
}

test('the tarball carries both halves of the ./oxlint entry', async () => {
    // Given - the file list npm would publish, and the entry package.json names
    const entry = oxlintEntry();
    const result = await integration.call(loadPublished);

    // Then - the ESM and CJS targets of `./oxlint` are both in the tarball
    expect(result.value.value.files).toContain(entry.import);
    expect(result.value.value.files).toContain(entry.require);
});

test('the published ./oxlint entry exposes only consumer rules', async () => {
    // Given - the plugin loaded from the files the tarball carries, ESM and CJS
    const result = await integration.call(loadPublished);

    // Then - every rule it registers, and every rule its fragment enables, speaks to a consumer
    for (const { audiences, recommended } of result.value.value.entries) {
        const ids = Object.keys(audiences);
        expect(ids.length).toBeGreaterThan(0);
        for (const id of ids) {
            expect(audiences[id], `${id} is published but not consumer`).toBe('consumer');
        }
        expect(recommended.toSorted()).toStrictEqual(
            ids.map((id) => `intelligence/${id}`).toSorted(),
        );
    }
});
