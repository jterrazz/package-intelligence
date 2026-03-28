import { describe, expect, test, vi } from "vitest";

// Ports
import type { ObservabilityPort } from "../ports/observability.port.js";
import type { ProviderMetadataPort } from "../ports/provider-metadata.port.js";
import { createObservabilityMiddleware, withObservability } from "./observability.middleware.js";

function createMockObservability() {
  return {
    trace: vi.fn(),
    generation: vi.fn(),
    flush: vi.fn().mockResolvedValue(undefined),
    shutdown: vi.fn().mockResolvedValue(undefined),
  } satisfies ObservabilityPort;
}

function createMockProviderMetadata() {
  return {
    extract: vi.fn().mockReturnValue({
      usage: {
        input: 10,
        output: 20,
        total: 30,
        reasoning: undefined,
        cacheRead: undefined,
      },
      cost: { total: 0.001 },
    }),
  } satisfies ProviderMetadataPort;
}

function createMockModel() {
  return {
    modelId: "anthropic/claude-sonnet",
    provider: "openrouter",
    specificationVersion: "v2" as const,
    supportsImageUrls: false,
    supportsStructuredOutputs: false,
    doGenerate: vi.fn(),
    doStream: vi.fn(),
  };
}

function createMockGenerateResult() {
  return {
    content: [{ type: "text" as const, text: "Hello world" }],
    finishReason: "stop" as const,
    usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
    providerOptions: {
      openrouter: {
        usage: {
          promptTokens: 10,
          completionTokens: 20,
          totalTokens: 30,
          cost: 0.001,
        },
      },
    },
    warnings: [],
  };
}

describe("createObservabilityMiddleware", () => {
  describe("wrapGenerate", () => {
    test("records generation when traceId is provided", async () => {
      // Given -- an observability middleware with traceId in provider options
      const observability = createMockObservability();
      const providerMetadata = createMockProviderMetadata();
      const middleware = createObservabilityMiddleware({ observability, providerMetadata });
      const mockResult = createMockGenerateResult();
      const doGenerate = vi.fn().mockResolvedValue(mockResult);
      const model = createMockModel();

      const params = {
        prompt: [{ role: "user", content: [{ type: "text", text: "Hello!" }] }],
        providerOptions: withObservability({
          traceId: "trace-123",
          name: "test-generation",
          metadata: { userId: "user-1" },
        }),
      };

      await middleware.wrapGenerate?.({
        doGenerate,
        doStream: vi.fn(),
        params: params as never,
        model: model as never,
      });

      // Then -- generation is recorded with correct details
      expect(observability.generation).toHaveBeenCalledTimes(1);
      expect(observability.generation).toHaveBeenCalledWith(
        expect.objectContaining({
          traceId: "trace-123",
          name: "test-generation",
          model: "anthropic/claude-sonnet",
          output: "Hello world",
          metadata: { userId: "user-1" },
          usage: {
            input: 10,
            output: 20,
            total: 30,
            reasoning: undefined,
            cacheRead: undefined,
          },
          cost: { total: 0.001 },
        }),
      );
    });

    test("does not record generation when traceId is missing", async () => {
      // Given -- an observability middleware with no traceId in params
      const observability = createMockObservability();
      const middleware = createObservabilityMiddleware({ observability });
      const mockResult = createMockGenerateResult();
      const doGenerate = vi.fn().mockResolvedValue(mockResult);
      const model = createMockModel();

      await middleware.wrapGenerate?.({
        doGenerate,
        doStream: vi.fn(),
        params: { prompt: [] } as never,
        model: model as never,
      });

      // Then -- generation is not recorded
      expect(observability.generation).not.toHaveBeenCalled();
    });

    test("uses default name when not provided", async () => {
      // Given -- an observability middleware with traceId but no name
      const observability = createMockObservability();
      const middleware = createObservabilityMiddleware({ observability });
      const mockResult = createMockGenerateResult();
      const doGenerate = vi.fn().mockResolvedValue(mockResult);
      const model = createMockModel();

      const params = {
        prompt: [],
        providerOptions: withObservability({ traceId: "trace-123" }),
      };

      await middleware.wrapGenerate?.({
        doGenerate,
        doStream: vi.fn(),
        params: params as never,
        model: model as never,
      });

      // Then -- the default name "generation" is used
      expect(observability.generation).toHaveBeenCalledWith(
        expect.objectContaining({ name: "generation" }),
      );
    });

    test("passes through the result unchanged", async () => {
      // Given -- an observability middleware wrapping a generate call
      const observability = createMockObservability();
      const middleware = createObservabilityMiddleware({ observability });
      const mockResult = createMockGenerateResult();
      const doGenerate = vi.fn().mockResolvedValue(mockResult);
      const model = createMockModel();

      const result = await middleware.wrapGenerate?.({
        doGenerate,
        doStream: vi.fn(),
        params: { prompt: [] } as never,
        model: model as never,
      });

      // Then -- the original result is returned unchanged
      expect(result).toBe(mockResult);
    });

    test("works without providerMetadata adapter", async () => {
      // Given -- an observability middleware without a provider metadata adapter
      const observability = createMockObservability();
      const middleware = createObservabilityMiddleware({ observability });
      const mockResult = createMockGenerateResult();
      const doGenerate = vi.fn().mockResolvedValue(mockResult);
      const model = createMockModel();

      const params = {
        prompt: [],
        providerOptions: withObservability({ traceId: "trace-123" }),
      };

      await middleware.wrapGenerate?.({
        doGenerate,
        doStream: vi.fn(),
        params: params as never,
        model: model as never,
      });

      // Then -- usage and cost are undefined
      expect(observability.generation).toHaveBeenCalledWith(
        expect.objectContaining({
          usage: undefined,
          cost: undefined,
        }),
      );
    });
  });
});

describe("withObservability", () => {
  test("creates properly structured metadata", () => {
    // Given -- observability options with traceId, name, and metadata
    const result = withObservability({
      traceId: "trace-123",
      name: "test",
      metadata: { key: "value" },
    });

    // Then -- the metadata is properly structured under the observability key
    expect(result).toEqual({
      observability: {
        traceId: "trace-123",
        name: "test",
        metadata: { key: "value" },
      },
    });
  });
});
