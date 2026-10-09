import { writeProjections } from '@jterrazz/typescript/rules';
import { resolve } from 'node:path';

import { CATALOGUE_CHAPTER } from '../consumer/catalogue/chapter.js';
import { catalogueProjection } from './corpus/catalogue.js';

writeProjections([catalogueProjection(resolve('.'))]);
process.stdout.write(`chapters: regenerated ${CATALOGUE_CHAPTER}\n`);
