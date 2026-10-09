import { basename } from 'node:path';

export function segments(path: string): string[] {
    return path.split(/[/\\]/u);
}

const TEST_FILE = /\.(?:test|spec)\.[cm]?tsx?$/u;

const TEST_FOLDERS = new Set(['__fixtures__', 'fixtures', 'specs']);

/** A test, a spec, or the ground one stands on: the file is a test's, never the application's. */
export function isTestMaterial(path: string): boolean {
    const parts = segments(path);
    return TEST_FILE.test(basename(path)) || parts.some((part) => TEST_FOLDERS.has(part));
}
