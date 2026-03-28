import type { LanguageModelV3 } from "@ai-sdk/provider";
import { describe, expect, test, vi } from "vitest";
import { z } from "zod";

import { generateStructured } from "../generate-structured.js";

function createMockModel(options: { text?: string; shouldThrow?: Error } = {}): LanguageModelV3 {
  const { text = "{}", shouldThrow } = options;

  return {
    specificationVersion: "v3",
    provider: "mock",
    modelId: "mock-model",
    doGenerate: shouldThrow
      ? vi.fn().mockRejectedValue(shouldThrow)
      : vi.fn().mockResolvedValue({
          text,
          finishReason: "stop",
          usage: { inputTokens: { total: 10 }, outputTokens: { total: 20 } },

          content: [{ type: "text", text }],
          warnings: [],
        }),
    supportedUrls: undefined as never,
    doStream: vi.fn(),
  };
}

describe("generateStructured", () => {
  const schema = z.object({
    name: z.string(),
    score: z.number(),
  });

  test("returns success with parsed data on valid response", async () => {
    // Given -- a mock model returning valid JSON matching the schema
    const model = createMockModel({
      text: JSON.stringify({ name: "test", score: 42 }),
    });

    const result = await generateStructured({
      model,
      prompt: "Generate data",
      schema,
    });

    // Then -- the result is a success with the parsed data
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({ name: "test", score: 42 });
    }
  });

  test("parses JSON from markdown code blocks", async () => {
    // Given -- a mock model returning JSON inside a markdown code block
    const jsonBlock = '```json\n{"name": "test", "score": 100}\n```';
    const model = createMockModel({ text: jsonBlock });

    const result = await generateStructured({
      model,
      prompt: "Generate data",
      schema,
    });

    // Then -- the JSON is extracted from the code block and parsed
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({ name: "test", score: 100 });
    }
  });

  test("returns EMPTY_RESULT for empty response", async () => {
    // Given -- a mock model returning an empty response
    const model = createMockModel({ text: "" });

    const result = await generateStructured({
      model,
      prompt: "Generate data",
      schema,
    });

    // Then -- the result is a failure with EMPTY_RESULT code
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("EMPTY_RESULT");
    }
  });

  test("returns PARSING_FAILED for invalid JSON", async () => {
    // Given -- a mock model returning invalid JSON
    const model = createMockModel({ text: "not valid json" });

    const result = await generateStructured({
      model,
      prompt: "Generate data",
      schema,
    });

    // Then -- the result is a failure with PARSING_FAILED code
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("PARSING_FAILED");
    }
  });

  test("returns TIMEOUT for timeout errors", async () => {
    // Given -- a mock model that throws a timeout error
    const model = createMockModel({
      shouldThrow: new Error("Request timed out"),
    });

    const result = await generateStructured({
      model,
      prompt: "Generate data",
      schema,
    });

    // Then -- the result is a failure with TIMEOUT code
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("TIMEOUT");
    }
  });

  test("returns RATE_LIMITED for rate limit errors", async () => {
    // Given -- a mock model that throws a rate limit error
    const model = createMockModel({
      shouldThrow: new Error("Rate limit exceeded"),
    });

    const result = await generateStructured({
      model,
      prompt: "Generate data",
      schema,
    });

    // Then -- the result is a failure with RATE_LIMITED code
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("RATE_LIMITED");
    }
  });

  test("passes provider options to generateText", async () => {
    // Given -- a mock model and provider options with observability trace
    const model = createMockModel({
      text: JSON.stringify({ name: "test", score: 1 }),
    });

    await generateStructured({
      model,
      prompt: "Generate data",
      schema,
      providerOptions: { observability: { traceId: "trace-123" } },
    });

    // Then -- provider options are forwarded to the model
    expect(model.doGenerate).toHaveBeenCalledWith(
      expect.objectContaining({
        providerOptions: { observability: { traceId: "trace-123" } },
      }),
    );
  });
});
