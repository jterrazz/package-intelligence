import { execFileSync } from 'node:child_process';
import { mkdirSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { expect, test } from 'vitest';

import { integration } from '../integration.specification.js';

// Extracted inside the package, so an entry's bare imports resolve to its node_modules as a consumer's would.
const ROOT = resolve(import.meta.dirname, '../../..');
const EXTRACTED = resolve(ROOT, '.artifacts/tarball');

const PACKED_FILES = [
    'LICENSE',
    'README.md',
    'package.json',
    ...['config', 'formatting', 'index', 'plugin'].flatMap((entry) =>
        ['cjs', 'cjs.map', 'js', 'js.map'].map((extension) => `dist/${entry}.${extension}`),
    ),
    ...['config', 'formatting', 'index', 'oxlint', 'types'].flatMap((entry) =>
        ['d.cts', 'd.ts'].map((extension) => `dist/${entry}.${extension}`),
    ),
    'dist/oxlint.cjs',
    'dist/oxlint.js',
].toSorted();

const EXPORT_NAMES: Record<string, string[]> = {
    '.': [
        'createAgentMiddleware',
        'createCostMiddleware',
        'createFallbackModel',
        'createGatewayProvider',
        'createIntelligence',
        'createLoggingMiddleware',
        'createOpenRouterProvider',
        'createSchemaInstructionMiddleware',
    ],
    './config': ['intelligence'],
    './formatting': ['cleanAiText', 'toSentenceCase'],
    './oxlint': ['default', 'intelligence', 'recommendedRules'],
};

const LOADERS: Record<string, 'import' | 'require'> = {
    default: 'import',
    import: 'import',
    node: 'import',
    require: 'require',
};

function field(value: unknown, key: string): unknown {
    return (typeof value === 'object' || typeof value === 'function') && value !== null
        ? Reflect.get(value, key)
        : undefined;
}

function keysOf(value: unknown): string[] {
    return (typeof value === 'object' || typeof value === 'function') && value !== null
        ? Object.keys(value)
        : [];
}

function membersOf(value: unknown): unknown[] {
    if (value instanceof Map || value instanceof Set) {
        return [...value.values()];
    }
    return [];
}

function collectAudiences(
    value: unknown,
    path: string,
    found: Record<string, unknown>,
    seen: Set<unknown>,
): void {
    if (
        (typeof value !== 'object' && typeof value !== 'function') ||
        value === null ||
        seen.has(value)
    ) {
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
    for (const [index, member] of membersOf(value).entries()) {
        collectAudiences(member, `${path}[${index}]`, found, seen);
    }
}

type LoadedEntry = {
    audiences: Record<string, unknown>;
    condition: string;
    exports: string[];
    module: unknown;
    subpath: string;
};

function loaded(subpath: string, condition: string, module: unknown): LoadedEntry {
    const audiences: Record<string, unknown> = {};
    const seen = new Set<unknown>();
    for (const key of keysOf(module)) {
        collectAudiences(field(module, key), key, audiences, seen);
    }
    return { audiences, condition, exports: keysOf(module).toSorted(), module, subpath };
}

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
    // Npm 11 prints an array of packs; npm 12 prints an object keyed by package name.
    const packs: unknown[] = Array.isArray(parsed)
        ? parsed
        : keysOf(parsed).map((key) => field(parsed, key));
    const filename = String(field(packs[0], 'filename'));
    execFileSync('tar', ['-xzf', resolve(EXTRACTED, filename), '-C', EXTRACTED]);
    return resolve(EXTRACTED, 'package');
}

function filesUnder(directory: string): string[] {
    return readdirSync(directory, { recursive: true, withFileTypes: true })
        .filter((entry) => entry.isFile())
        .map((entry) => relative(directory, resolve(entry.parentPath, entry.name)));
}

function exportTargets(exports: unknown): Record<string, Record<string, string>> {
    return Object.fromEntries(
        keysOf(exports).map((subpath) => {
            const target = field(exports, subpath);
            const byCondition =
                typeof target === 'string'
                    ? { default: target }
                    : Object.fromEntries(
                          keysOf(target).map((condition) => [
                              condition,
                              String(field(target, condition)),
                          ]),
                      );
            return [subpath, byCondition];
        }),
    );
}

type Published = {
    bin: unknown;
    entries: LoadedEntry[];
    files: string[];
    targets: Record<string, Record<string, string>>;
};

async function loadPublished(): Promise<Published> {
    const installed = packAndExtract();
    const manifest: unknown = JSON.parse(readFileSync(resolve(installed, 'package.json'), 'utf8'));
    const targets = exportTargets(field(manifest, 'exports'));
    const load = createRequire(pathToFileURL(resolve(installed, 'package.json')).href);
    const loads = Object.entries(targets).flatMap(([subpath, byCondition]) =>
        Object.entries(byCondition)
            .filter(([condition]) => condition in LOADERS)
            .map(async ([condition, target]) => {
                const path = resolve(installed, target);
                const module: unknown =
                    LOADERS[condition] === 'require'
                        ? load(path)
                        : await import(pathToFileURL(path).href);
                return loaded(subpath, condition, module);
            }),
    );
    const files = filesUnder(installed).toSorted();
    return {
        bin: field(manifest, 'bin'),
        entries: await Promise.all(loads),
        files,
        targets,
    };
}

const loadedPackage = await integration.call(loadPublished);
const published = loadedPackage.value.value;

function oxlintEntries(): LoadedEntry[] {
    return published.entries.filter(({ subpath }) => subpath === './oxlint');
}

test('the tarball carries exactly the reviewed file set', () => {
    // Given - every file of the extracted tarball
    // Then - it is the three entries' bundles, types and maps, plus the package's own files
    expect(published.files).toStrictEqual(PACKED_FILES);
});

test('the package publishes no bin', () => {
    // Given - the extracted package.json
    // Then - it declares no executable a consumer could run
    expect(published.bin).toBeUndefined();
});

test('every published entry loads under each condition Node resolves', () => {
    // Given - the extracted package.json's exports map
    // Then - each subpath names an ESM and a CJS target, and nothing Node would not load
    expect(Object.keys(published.targets).toSorted()).toStrictEqual(
        Object.keys(EXPORT_NAMES).toSorted(),
    );
    for (const [subpath, byCondition] of Object.entries(published.targets)) {
        expect(Object.keys(byCondition).toSorted(), `${subpath} conditions`).toStrictEqual([
            'import',
            'require',
        ]);
        for (const target of Object.values(byCondition)) {
            expect(target, `${subpath} target`).toMatch(/^\.\/dist\//u);
        }
    }
    expect(published.entries).toHaveLength(Object.keys(EXPORT_NAMES).length * 2);
});

test('every published entry exports exactly its reviewed names', () => {
    // Given - each entry as npm ships it, under each condition
    for (const { condition, exports, subpath } of published.entries) {
        // Then - a new export has to pass review before it can ship
        expect(exports, `${subpath} (${condition})`).toStrictEqual(EXPORT_NAMES[subpath]);
    }
});

test('every rule any published entry carries is a consumer rule', () => {
    // Given - every export value of every published entry, walked to each rule-shaped value
    for (const { audiences } of oxlintEntries()) {
        expect(Object.keys(audiences).length).toBeGreaterThan(0);
    }
    for (const { audiences, condition, subpath } of published.entries) {
        for (const [path, audience] of Object.entries(audiences)) {
            // Then - it speaks to a consumer project, never to this package's own suite
            expect(
                audience,
                `${subpath} (${condition}) ${path} is published but not consumer`,
            ).toBe('consumer');
        }
    }
});

test('the ./oxlint fragment enables exactly the rules its plugin registers', () => {
    // Given - the plugin and its recommended rule map, under each condition
    for (const { module } of oxlintEntries()) {
        const ids = keysOf(field(field(module, 'default'), 'rules'));

        // Then - the plugin registers rules, and the fragment enables every one of them
        expect(ids.length).toBeGreaterThan(0);
        expect(keysOf(field(module, 'recommendedRules')).toSorted()).toStrictEqual(
            ids.map((id) => `intelligence/${id}`).toSorted(),
        );
    }
});
