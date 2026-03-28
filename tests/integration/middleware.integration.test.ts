import type { LanguageModelV1 } from "@ai-sdk/provider";
import { wrapLanguageModel } from "ai";
import { describe, expect, test, vi } from "vitest";

import {
  createLoggingMiddleware,
  createObservabilityMiddleware,
  type ObservabilityPort,
  OpenRouterMetadataAdapter,
  withObservability,
} from "../src/index.js";

function createMockLogger() {
  const logger = {
    child: vi.fn(() => logger),
    debug: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  };
  return logger;
}

function createMockObservability() {
  return {
    trace: vi.fn(),
    generation: vi.fn(),
    flush: vi.fn().mockResolvedValue(undefined),
    shutdown: vi.fn().mockResolvedValue(undefined),
  } satisfies ObservabilityPort;
}

function createMockLanguageModel(
  options: {
    text?: string;
    usage?: { promptTokens: number; completionTokens: number };
    providerMetadata?: Record<string, unknown>;
  } = {},
): LanguageModelV1 {
  const {
    text = "Hello, world!",
    usage = { promptTokens: 10, completionTokens: 20 },
    providerMetadata,
  } = options;

  return {
    specificationVersion: "v1",
    provider: "mock",
    modelId: "mock-model",
    defaultObjectGenerationMode: "json",
    doGenerate: vi.fn().mockResolvedValue({
      text,
      finishReason: "stop",
      usage,
      rawCall: { rawPrompt: null, rawSettings: {} },
      providerMetadata,
      // V2 middleware expects content array
      content: [{ type: "text", text }],
    }),
    doStream: vi.fn().mockResolvedValue({
      stream: new ReadableStream({
        start(controller) {
          controller.enqueue({ type: "text-delta", textDelta: text });
          controller.enqueue({ type: "finish", finishReason: "stop", usage });
          controller.close();
        },
      }),
      rawCall: { rawPrompt: null, rawSettings: {} },
    }),
  };
}

describe("middleware integration with wrapLanguageModel", () => {
  describe("logging middleware", () => {
    test("logs generate calls with timing and usage", async () => {
      // Given -- a wrapped model with logging middleware
      const logger = createMockLogger();
      const baseModel = createMockLanguageModel({
        usage: { promptTokens: 10, completionTokens: 20 },
      });

      const model = wrapLanguageModel({
        model: baseModel,
        middleware: createLoggingMiddleware({ logger }),
      });

      await model.doGenerate({
        prompt: [{ role: "user", content: [{ type: "text", text: "Say hello" }] }],
      });

      // Then -- start and completion are logged with timing and usage
      expect(logger.debug).toHaveBeenCalledWith(
        "ai.generate.start",
        expect.objectContaining({
          model: "mock-model",
        }),
      );
      expect(logger.debug).toHaveBeenCalledWith(
        "ai.generate.complete",
        expect.objectContaining({
          durationMs: expect.any(Number),
          usage: expect.objectContaining({
            promptTokens: 10,
            completionTokens: 20,
          }),
        }),
      );
    });

    test("logs content when include.content is true", async () => {
      // Given -- a wrapped model with logging middleware configured to include content
      const logger = createMockLogger();
      const baseModel = createMockLanguageModel({ text: "Response text" });

      const model = wrapLanguageModel({
        model: baseModel,
        middleware: createLoggingMiddleware({ logger, include: { content: true } }),
      });

      await model.doGenerate({
        prompt: [{ role: "user", content: [{ type: "text", text: "Test" }] }],
      });

      // Then -- the completion log includes the response content
      expect(logger.debug).toHaveBeenCalledWith(
        "ai.generate.complete",
        expect.objectContaining({
          content: "Response text",
        }),
      );
    });
  });

  describe("observability middleware", () => {
    test("records generation with trace metadata", async () => {
      // Given -- a wrapped model with observability middleware and trace options
      const observability = createMockObservability();
      const baseModel = createMockLanguageModel({ text: "AI response" });

      const model = wrapLanguageModel({
        model: baseModel,
        middleware: createObservabilityMiddleware({ observability }),
      });

      await model.doGenerate({
        prompt: [{ role: "user", content: [{ type: "text", text: "Analyze this" }] }],
        providerOptions: withObservability({
          traceId: "trace-123",
          name: "analyzer",
          metadata: { userId: "user-1" },
        }),
      });

      // Then -- generation is recorded with trace metadata
      expect(observability.generation).toHaveBeenCalledWith(
        expect.objectContaining({
          traceId: "trace-123",
          name: "analyzer",
          output: "AI response",
          metadata: { userId: "user-1" },
          startTime: expect.any(Date),
          endTime: expect.any(Date),
        }),
      );
    });

    test("does not record when traceId is missing", async () => {
      // Given -- a wrapped model with observability middleware but no traceId
      const observability = createMockObservability();
      const baseModel = createMockLanguageModel();

      const model = wrapLanguageModel({
        model: baseModel,
        middleware: createObservabilityMiddleware({ observability }),
      });

      await model.doGenerate({
        prompt: [{ role: "user", content: [{ type: "text", text: "Hello" }] }],
      });

      // Then -- generation is not recorded
      expect(observability.generation).not.toHaveBeenCalled();
    });

    test("extracts usage and cost with provider metadata adapter", async () => {
      // Given -- a wrapped model with observability and OpenRouter metadata adapter
      const observability = createMockObservability();
      const baseModel = createMockLanguageModel({
        text: "Response",
        providerMetadata: {
          openrouter: {
            usage: {
              promptTokens: 100,
              completionTokens: 50,
              totalTokens: 150,
              cost: 0.0025,
            },
          },
        },
      });

      const model = wrapLanguageModel({
        model: baseModel,
        middleware: createObservabilityMiddleware({
          observability,
          providerMetadata: new OpenRouterMetadataAdapter(),
        }),
      });

      await model.doGenerate({
        prompt: [{ role: "user", content: [{ type: "text", text: "Test" }] }],
        providerOptions: withObservability({ traceId: "trace-456" }),
      });

      // Then -- usage and cost are extracted from provider metadata
      expect(observability.generation).toHaveBeenCalledWith(
        expect.objectContaining({
          usage: expect.objectContaining({
            input: 100,
            output: 50,
            total: 150,
          }),
          cost: { total: 0.0025 },
        }),
      );
    });
  });

  describe("middleware composition", () => {
    test("both middlewares execute when composed", async () => {
      // Given -- a model wrapped with both logging and observability middleware
      const logger = createMockLogger();
      const observability = createMockObservability();
      const baseModel = createMockLanguageModel({ text: "Combined response" });

      const model = wrapLanguageModel({
        model: baseModel,
        middleware: [
          createLoggingMiddleware({ logger }),
          createObservabilityMiddleware({ observability }),
        ],
      });

      await model.doGenerate({
        prompt: [{ role: "user", content: [{ type: "text", text: "Test composition" }] }],
        providerOptions: withObservability({
          traceId: "trace-789",
          name: "composed-call",
        }),
      });

      // Then -- both logging and observability middleware executed
      expect(logger.debug).toHaveBeenCalledWith("ai.generate.start", expect.any(Object));
      expect(logger.debug).toHaveBeenCalledWith("ai.generate.complete", expect.any(Object));

      expect(observability.generation).toHaveBeenCalledWith(
        expect.objectContaining({
          traceId: "trace-789",
          name: "composed-call",
          output: "Combined response",
        }),
      );
    });
  });
});
