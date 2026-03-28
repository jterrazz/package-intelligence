import { describe, expect, test } from "vitest";

import { OpenAICompatibleMetadataAdapter } from "../openai-compatible-metadata.adapter.js";

describe("OpenAICompatibleMetadataAdapter", () => {
  const adapter = new OpenAICompatibleMetadataAdapter();

  test("extracts usage tokens from OpenAI-compatible metadata", () => {
    // Given -- metadata with full usage tokens
    const metadata = {
      openai: {
        usage: {
          promptTokens: 200,
          completionTokens: 80,
          totalTokens: 280,
        },
      },
    };

    const result = adapter.extract(metadata);

    // Then -- usage tokens are correctly extracted
    expect(result).toEqual({
      usage: {
        input: 200,
        output: 80,
        total: 280,
      },
    });
  });

  test("returns empty object when metadata is undefined", () => {
    // Given -- undefined metadata
    const result = adapter.extract(undefined);

    // Then -- returns empty object
    expect(result).toEqual({});
  });

  test("returns empty object when metadata has no openai key", () => {
    // Given -- metadata without openai key
    const result = adapter.extract({ someOtherProvider: {} });

    // Then -- returns empty object
    expect(result).toEqual({});
  });

  test("returns empty object when openai metadata has no usage", () => {
    // Given -- openai metadata without usage field
    const result = adapter.extract({ openai: {} });

    // Then -- returns empty object
    expect(result).toEqual({});
  });

  test("defaults to 0 for missing promptTokens and completionTokens", () => {
    // Given -- metadata with only totalTokens
    const metadata = {
      openai: {
        usage: {
          totalTokens: 150,
        },
      },
    };

    const result = adapter.extract(metadata);

    // Then -- missing token counts default to 0, total is preserved
    expect(result.usage?.input).toBe(0);
    expect(result.usage?.output).toBe(0);
    expect(result.usage?.total).toBe(150);
  });

  test("leaves total undefined when totalTokens is missing", () => {
    // Given -- metadata without totalTokens
    const metadata = {
      openai: {
        usage: {
          promptTokens: 100,
          completionTokens: 50,
        },
      },
    };

    const result = adapter.extract(metadata);

    // Then -- total is undefined since totalTokens was not provided
    expect(result.usage?.input).toBe(100);
    expect(result.usage?.output).toBe(50);
    expect(result.usage?.total).toBeUndefined();
  });

  test("does not extract cost (not supported by this adapter)", () => {
    // Given -- metadata with usage tokens
    const metadata = {
      openai: {
        usage: {
          promptTokens: 100,
          completionTokens: 50,
          totalTokens: 150,
        },
      },
    };

    const result = adapter.extract(metadata);

    // Then -- cost is not present in the result
    expect(result.cost).toBeUndefined();
  });
});
