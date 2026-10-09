import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

const loaded = [
    ['. (import)', await import('@jterrazz/intelligence')],
    ['. (require)', require('@jterrazz/intelligence')],
    ['./config (import)', await import('@jterrazz/intelligence/config')],
    ['./formatting (import)', await import('@jterrazz/intelligence/formatting')],
    ['./formatting (require)', require('@jterrazz/intelligence/formatting')],
    ['./oxlint (import)', await import('@jterrazz/intelligence/oxlint')],
];

for (const [subpath, module] of loaded) {
    console.log(`${subpath}: ${Object.keys(module).toSorted().join(', ')}`);
}
