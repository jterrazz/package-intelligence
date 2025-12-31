import { describe, expect, it } from 'vitest';

import { OpenRouterMetadataAdapter } from '../openrouter-metadata.adapter.js';

describe('OpenRouterMetadataAdapter', () => {
    const adapter = new OpenRouterMetadataAdapter();

    it('extracts usage and cost from OpenRouter metadata', () => {
        const metadata = {
            openrouter: {
                usage: {
                    promptTokens: 100,
                    completionTokens: 50,
                    totalTokens: 150,
                    cost: 0.0025,
                },
            },
        };

        const result = adapter.extract(metadata);

        expect(result).toEqual({
            usage: {
                input: 100,
                output: 50,
                total: 150,
                reasoning: undefined,
                cacheRead: undefined,
            },
            cost: { total: 0.0025 },
        });
    });

    it('extracts reasoning tokens when present', () => {
        const metadata = {
            openrouter: {
                usage: {
                    promptTokens: 100,
                    completionTokens: 50,
                    completionTokensDetails: { reasoningTokens: 30 },
                    totalTokens: 150,
                },
            },
        };

        const result = adapter.extract(metadata);

        expect(result.usage?.reasoning).toBe(30);
    });

    it('extracts cached tokens when present', () => {
        const metadata = {
            openrouter: {
                usage: {
                    promptTokens: 100,
                    promptTokensDetails: { cachedTokens: 80 },
                    completionTokens: 50,
                    totalTokens: 150,
                },
            },
        };

        const result = adapter.extract(metadata);

        expect(result.usage?.cacheRead).toBe(80);
    });

    it('returns empty object when no openrouter metadata', () => {
        const result = adapter.extract(undefined);
        expect(result).toEqual({});
    });

    it('returns empty object when no usage in metadata', () => {
        const result = adapter.extract({ openrouter: {} });
        expect(result).toEqual({});
    });

    it('defaults to 0 for missing token counts', () => {
        const metadata = {
            openrouter: {
                usage: {
                    totalTokens: 100,
                },
            },
        };

        const result = adapter.extract(metadata);

        expect(result.usage?.input).toBe(0);
        expect(result.usage?.output).toBe(0);
        expect(result.usage?.total).toBe(100);
    });

    it('omits cost when not present', () => {
        const metadata = {
            openrouter: {
                usage: {
                    promptTokens: 100,
                    completionTokens: 50,
                },
            },
        };

        const result = adapter.extract(metadata);

        expect(result.cost).toBeUndefined();
    });
});
