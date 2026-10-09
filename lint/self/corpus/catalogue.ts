import type { Projection } from '@jterrazz/typescript/rules';
import { resolve } from 'node:path';

import { CATALOGUE_CHAPTER, CATALOGUE_MARKERS } from '../../consumer/catalogue/chapter.js';
import { FAMILIES } from '../../consumer/catalogue/families.js';
import { consumerRows } from '../../consumer/catalogue/manifest.js';
import { catalogueBody } from '../../kit/catalogue/chapter.js';

/** The catalogue's chapter under a root, as the rows write it. */
export function catalogueProjection(root: string): Projection {
    return {
        markers: CATALOGUE_MARKERS,
        page: resolve(root, CATALOGUE_CHAPTER),
        render: () => catalogueBody(consumerRows, FAMILIES),
    };
}
