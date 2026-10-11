import { existsSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';

import { segments } from './paths.js';

// invariant: a folder marked `_<subject>/` holds what several agents share; `__tests__/` and the other `__x__` folders are not one.
const SUBJECT_FOLDER = /^_[a-z][a-z0-9-]*$/u;

export type AgentFile = { name: string };

export type PromptFile = { name: string; shared: boolean; sibling: string };

export function isUnderAgentsFolder(filePath: string): boolean {
    return segments(filePath).includes('agents');
}

export function detectAgentFile(filePath: string): AgentFile | undefined {
    const parts = segments(filePath);
    const base = basename(filePath);
    // invariant: a prompt or a test beside its agent is named for it plus a suffix, so its stem never matches its folder.
    if (!base.endsWith('.ts')) {
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

export function detectPromptFile(filePath: string): PromptFile | undefined {
    const base = basename(filePath);
    if (!base.endsWith('.prompt.ts')) {
        return undefined;
    }
    const name = base.slice(0, -'.prompt.ts'.length);
    return {
        name,
        shared: SUBJECT_FOLDER.test(basename(dirname(filePath))),
        sibling: join(dirname(filePath), `${name}.ts`),
    };
}

export function siblingExists(prompt: PromptFile): boolean {
    return existsSync(prompt.sibling);
}
