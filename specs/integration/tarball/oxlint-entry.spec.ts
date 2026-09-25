import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { expect, test } from 'vitest';

import { integration } from '../integration.specification.js';

/**
 * The package as npm publishes it: `npm pack` writes the tarball, the spec
 * extracts it, and every entry `package.json` exports is loaded from the
 * extracted bytes, ESM and CJS. Every rule any published entry exposes is a
 * `consumer` rule. The tarball carries the BUILT `dist/`, so `npm run build`
 * precedes this spec. It is extracted under `.artifacts/tarball/`, inside the
 * package, so an entry's bare imports resolve to this package's
 * `node_modules` the way they would to a consumer's.
 */
const ROOT = resolve(import.meta.dirname, '../../..');

/** Every export value of one loaded module, and the audience of every rule-shaped object reachable from them. */
type EntrySurface = {
    audiences: Record<string, unknown>;
    exports: string[];
    module: unknown;
};

/** Reads `key` off a value of unknown shape — `undefined` when it is not an object. */
function field(value: unknown, key: string): unknown {
    return (typeof value === 'object' || typeof value === 'function') && value !== null
        ? Reflect.get(value, key)
        : undefined;
}

function keysOf(value: unknown): string[] {
    return typeof value === 'object' && value !== null ? Object.keys(value) : [];
}

/**
 * Walks every value reachable from `value` through own enumerable keys, and
 * records the `meta.docs.audience` of each object that sets one, by path.
 */
function collectAudiences(
    value: unknown,
    path: string,
    found: Record<string, unknown>,
    seen: Set<unknown>,
): void {
    if (typeof value !== 'object' || value === null || seen.has(value)) {
        return;
    }
    seen.add(value);
    const audience = field(field(field(value, 'meta'), 'docs'), 'audience');
    if (audience !== undefined) {
        found[path] = audience;
    }
    for (const key of keysOf(value)) {
        collectAudiences(field(value, key), `${path}.${key}`, found, seen);
    }
}

function surfaceOf(module: unknown): EntrySurface {
    const audiences: Record<string, unknown> = {};
    const seen = new Set<unknown>();
    for (const key of keysOf(module)) {
        collectAudiences(field(module, key), key, audiences, seen);
    }
    return { audiences, exports: keysOf(module).toSorted(), module };
}

function packagePath(target: unknown): string {
    return String(target).replace(/^\.\//u, '');
}

/** The `exports` map of `package.json`: subpath → its ESM and CJS targets. */
function exportMap(): Record<string, { import: string; require: string }> {
    const manifest: unknown = JSON.parse(readFileSync(resolve(ROOT, 'package.json'), 'utf8'));
    const map = field(manifest, 'exports');
    return Object.fromEntries(
        keysOf(map).map((subpath) => [
            subpath,
            {
                import: packagePath(field(field(map, subpath), 'import')),
                require: packagePath(field(field(map, subpath), 'require')),
            },
        ]),
    );
}

const EXTRACTED = resolve(ROOT, '.artifacts/tarball');

/** Packs the package, extracts the tarball, and returns the directory npm would install. */
function packAndExtract(): string {
    rmSync(EXTRACTED, { force: true, recursive: true });
    mkdirSync(EXTRACTED, { recursive: true });
    const parsed: unknown = JSON.parse(
        execFileSync(
            'npm',
            ['pack', '--json', '--ignore-scripts', '--pack-destination', EXTRACTED],
            { cwd: ROOT, encoding: 'utf8' },
        ),
    );
    // Older npm prints an array of packs; npm 12 prints an object keyed by package name.
    const packs: unknown[] = Array.isArray(parsed)
        ? parsed
        : keysOf(parsed).map((key) => field(parsed, key));
    const filename = String(field(packs[0], 'filename'));
    execFileSync('tar', ['-xzf', resolve(EXTRACTED, filename), '-C', EXTRACTED]);
    return resolve(EXTRACTED, 'package');
}

type PublishedEntry = { cjs: EntrySurface; esm: EntrySurface; subpath: string };

async function loadPublished(): Promise<PublishedEntry[]> {
    const installed = packAndExtract();
    const load = createRequire(pathToFileURL(resolve(installed, 'package.json')).href);
    return await Promise.all(
        Object.entries(exportMap()).map(async ([subpath, target]) => {
            const esm: unknown = await import(
                pathToFileURL(resolve(installed, target.import)).href
            );
            const cjs: unknown = load(resolve(installed, target.require));
            return { cjs: surfaceOf(cjs), esm: surfaceOf(esm), subpath };
        }),
    );
}

const published = await integration.call(loadPublished);
const entries = published.value.value;

function oxlintEntry(): PublishedEntry {
    const entry = entries.find(({ subpath }) => subpath === './oxlint');
    if (entry === undefined) {
        throw new Error('package.json exports no ./oxlint entry');
    }
    return entry;
}

test('the published entries are exactly those package.json exports', () => {
    // Given - the entries loaded from the extracted tarball
    // Then - each subpath package.json names loaded, ESM and CJS
    expect(entries.map(({ subpath }) => subpath).toSorted()).toStrictEqual(
        ['.', './formatting', './oxlint'].toSorted(),
    );
});

test('the published ./oxlint entry exports exactly the plugin, its fragment and its rule map', () => {
    // Given - the ./oxlint entry as npm ships it
    const { cjs, esm } = oxlintEntry();

    // Then - a new export has to pass review before it can ship
    expect(esm.exports).toStrictEqual(['default', 'intelligence', 'recommendedRules']);
    expect(cjs.exports).toStrictEqual(['default', 'intelligence', 'recommendedRules']);
});

test('every rule any published entry carries is a consumer rule', () => {
    // Given - every export value of every published entry, walked to each rule-shaped object
    expect(Object.keys(oxlintEntry().esm.audiences).length).toBeGreaterThan(0);
    expect(Object.keys(oxlintEntry().cjs.audiences).length).toBeGreaterThan(0);
    for (const { cjs, esm, subpath } of entries) {
        for (const [path, audience] of Object.entries({ ...esm.audiences, ...cjs.audiences })) {
            // Then - it speaks to a consumer project, never to this package's own suite
            expect(audience, `${subpath} ${path} is published but not consumer`).toBe('consumer');
        }
    }
});

test('the ./oxlint fragment enables exactly the rules its plugin registers', () => {
    // Given - the plugin and its recommended rule map, ESM and CJS
    for (const { module } of [oxlintEntry().esm, oxlintEntry().cjs]) {
        const ids = keysOf(field(field(module, 'default'), 'rules'));

        // Then - the plugin registers rules, and the fragment enables every one of them
        expect(ids.length).toBeGreaterThan(0);
        expect(keysOf(field(module, 'recommendedRules')).toSorted()).toStrictEqual(
            ids.map((id) => `intelligence/${id}`).toSorted(),
        );
    }
});
