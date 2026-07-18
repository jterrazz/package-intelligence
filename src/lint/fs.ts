import { existsSync } from 'node:fs';

/**
 * Filesystem probe for the one fs-anchored rule (P3 — the sibling check).
 * Mirrors `@jterrazz/test`'s `src/lint/fs-cache.ts` in spirit, minus the
 * memoization: P3 does at most one `existsSync` per visited file, so a cache
 * would add complexity without a measurable payoff at this plugin's size.
 */
export function fileExists(path: string): boolean {
    try {
        return existsSync(path);
    } catch {
        return false;
    }
}
