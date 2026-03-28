import { describe, expect, test } from "vitest";

import { OpenRouterMetadataAdapter } from "./openrouter-metadata.adapter.js";

describe("OpenRouterMetadataAdapter", () => {
  const adapter = new OpenRouterMetadataAdapter();

  test("extracts usage and cost from OpenRouter metadata", () => {
    // Given -- metadata with usage tokens and cost
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

    // Then -- usage and cost are correctly extracted
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

  test("extracts reasoning tokens when present", () => {
    // Given -- metadata with reasoning token details
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

    // Then -- reasoning tokens are extracted
    expect(result.usage?.reasoning).toBe(30);
  });

  test("extracts cached tokens when present", () => {
    // Given -- metadata with cached token details
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

    // Then -- cached tokens are extracted
    expect(result.usage?.cacheRead).toBe(80);
  });

  test("returns empty object when no openrouter metadata", () => {
    // Given -- undefined metadata
    const result = adapter.extract(undefined);

    // Then -- returns empty object
    expect(result).toEqual({});
  });

  test("returns empty object when no usage in metadata", () => {
    // Given -- metadata without usage field
    const result = adapter.extract({ openrouter: {} });

    // Then -- returns empty object
    expect(result).toEqual({});
  });

  test("defaults to 0 for missing token counts", () => {
    // Given -- metadata with only totalTokens
    const metadata = {
      openrouter: {
        usage: {
          totalTokens: 100,
        },
      },
    };

    const result = adapter.extract(metadata);

    // Then -- missing token counts default to 0
    expect(result.usage?.input).toBe(0);
    expect(result.usage?.output).toBe(0);
    expect(result.usage?.total).toBe(100);
  });

  test("omits cost when not present", () => {
    // Given -- metadata with usage but no cost
    const metadata = {
      openrouter: {
        usage: {
          promptTokens: 100,
          completionTokens: 50,
        },
      },
    };

    const result = adapter.extract(metadata);

    // Then -- cost is undefined
    expect(result.cost).toBeUndefined();
  });
});
