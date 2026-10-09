import { anchorsOf, projected, readAt } from '@jterrazz/typescript/rules';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, test } from 'vitest';

import { CATALOGUE_CHAPTER } from '../../../consumer/catalogue/chapter.js';
import { consumerRows } from '../../../consumer/catalogue/manifest.js';
import { catalogueProjection } from '../catalogue.js';

const ROOT = resolve(import.meta.dirname, '../../../..');

const chapter = readFileSync(resolve(ROOT, CATALOGUE_CHAPTER), 'utf8');

describe('catalogueProjection', () => {
    test('the chapter holds the catalogue as the rows write it', () => {
        // Given - the chapter on disk, projected again from the rows
        const projection = catalogueProjection(ROOT);
        const regenerated = projected(chapter, projection.page, [projection]);

        // Then - nothing moved: `npm run docs` has run since the last change of a row
        expect(regenerated).toBe(chapter);
    });

    test('every rule’s lesson reads an anchor the chapter holds', () => {
        // Given - the anchors of the chapter, and the read of each row's lessons
        const anchors = anchorsOf(chapter);
        const unread = consumerRows
            .map((row) => readAt(row, CATALOGUE_CHAPTER))
            .filter((read) => !anchors.has(read.slice(read.indexOf('#') + 1)));

        // Then - no lesson sends its reader to a heading that is not there
        expect(unread).toStrictEqual([]);
    });
});
