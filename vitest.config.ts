import { defineSpecConfig, integration, unit } from '@jterrazz/test/vitest';

export default defineSpecConfig({
    test: { projects: [unit(), integration()] },
});
