import { existsSync } from 'node:fs';

export function fileExists(path: string): boolean {
    try {
        return existsSync(path);
    } catch {
        return false;
    }
}
