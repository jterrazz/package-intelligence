import { specification } from '@jterrazz/test';
import { afterAll } from 'vitest';

// No services: what earns this facet here is the golden, not a container — the
// package's subjects are pure text, a composed model and a linter's own output.
export const { cleanup, integration } = await specification.integration();

afterAll(cleanup);
