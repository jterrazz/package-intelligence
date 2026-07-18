import { dirname } from 'node:path';

import { segments } from './ast.js';

/**
 * Shared "is this file an agent file / a prompt file?" detection for
 * P1/P3/G1 — the folder-per-agent convention documented in the README's
 * "Agent & prompt conventions" section:
 *
 * ```
 * agents/<name>/<name>.ts          # the agent file
 * agents/<name>/<name>.prompt.ts   # the prompt file
 * agents/_shared/<name>.prompt.ts  # shared prompt sections (P3-exempt)
 * ```
 */

/** An **agent file**: `<name>.ts` in a `<name>/` folder under an `agents/` ancestor. */
export type AgentFile = { name: string };

/** A **prompt file**: `*.prompt.ts`, its directory, and whether it's under `_shared/`. */
export type PromptFile = { dir: string; name: string; shared: boolean };

/**
 * Is `filePath` under a folder literally named `agents` (exact path segment,
 * anywhere in the path — P1's broader scope, unlike {@link detectAgentFile}'s
 * narrower `<name>/<name>.ts` shape)?
 */
export function isUnderAgentsFolder(filePath: string): boolean {
    return segments(filePath).includes('agents');
}

/**
 * `agents/<name>/<name>.ts` — the file basename (minus `.ts`) must equal its
 * parent directory name, and an `agents` segment must be a proper ancestor of
 * that parent directory. Returns `undefined` for anything else, including
 * `*.prompt.ts` and `*.test.ts` (never agent files).
 */
export function detectAgentFile(filePath: string): AgentFile | undefined {
    const parts = segments(filePath);
    const base = parts.at(-1);
    if (base === undefined || !base.endsWith('.ts')) {
        return undefined;
    }
    if (base.endsWith('.prompt.ts') || base.endsWith('.test.ts')) {
        return undefined;
    }
    const stem = base.slice(0, -'.ts'.length);
    const parentIndex = parts.length - 2;
    if (parts[parentIndex] !== stem) {
        return undefined;
    }
    const agentsIndex = parts.lastIndexOf('agents');
    if (agentsIndex === -1 || agentsIndex >= parentIndex) {
        return undefined;
    }
    return { name: stem };
}

/** `<name>.prompt.ts` — any directory; `shared` is true directly under `_shared/`. */
export function detectPromptFile(filePath: string): PromptFile | undefined {
    const parts = segments(filePath);
    const base = parts.at(-1);
    if (base === undefined || !base.endsWith('.prompt.ts')) {
        return undefined;
    }
    const stem = base.slice(0, -'.prompt.ts'.length);
    return {
        dir: dirname(filePath),
        name: stem,
        shared: parts.at(-2) === '_shared',
    };
}
