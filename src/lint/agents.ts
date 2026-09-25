import { dirname } from 'node:path';

import { segments } from './ast.js';

export type AgentFile = { name: string };

export type PromptFile = { dir: string; name: string; shared: boolean };

export function isUnderAgentsFolder(filePath: string): boolean {
    return segments(filePath).includes('agents');
}

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
