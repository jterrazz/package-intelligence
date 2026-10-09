import { describe, expect, test } from 'vitest';

import { consumerRows } from '../../catalogue/manifest.js';
import plugin from '../plugin.js';

describe('plugin', () => {
    test('the plugin registers one rule per catalogue row, each carrying its row', () => {
        // Given - the plugin the `./oxlint` entry ships
        const registered = Object.entries(plugin.rules).map(([name, rule]) => [
            name,
            rule.meta.docs,
        ]);

        // Then - every row is a rule under its own name, a consumer's, and no rule stands outside the catalogue
        expect(registered).toStrictEqual(consumerRows.map((row) => [row.name, row]));
        expect(new Set(consumerRows.map(({ audience }) => audience))).toStrictEqual(
            new Set(['consumer']),
        );
    });
});
