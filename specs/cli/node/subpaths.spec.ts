import { directory, packed } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

import { cli } from '../cli.specification.js';

describe('subpaths', () => {
    test('every published subpath loads from the tarball under each condition it declares', async () => {
        // Given - a consumer's project with the packed package, the AI SDK and the toolchain its presets build on
        const result = await cli
            .fixture(directory('./__fixtures__/consumer/'))
            .link('@jterrazz/intelligence', packed())
            .link('ai')
            .link('@jterrazz/typescript')
            .exec('subpaths.mjs');

        // Then - each subpath names its reviewed API, the same under import and require
        expect(result.exitCode).toBe(0);
        expect(result.stdout).toMatch(`
            . (import): createAgentMiddleware, createCostMiddleware, createFallbackModel, createGatewayProvider, createIntelligence, createLoggingMiddleware, createOpenRouterProvider, createSchemaInstructionMiddleware
            . (require): createAgentMiddleware, createCostMiddleware, createFallbackModel, createGatewayProvider, createIntelligence, createLoggingMiddleware, createOpenRouterProvider, createSchemaInstructionMiddleware
            ./config (import): intelligence
            ./formatting (import): cleanAiText, toSentenceCase
            ./formatting (require): cleanAiText, toSentenceCase
            ./oxlint (import): default, recommendedRules
        `);
    });
});
