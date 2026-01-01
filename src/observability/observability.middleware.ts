import type { LanguageModelV3StreamPart } from "@ai-sdk/provider";
import type { LanguageModelMiddleware } from "ai";

// Ports
import type { ObservabilityPort } from "../ports/observability.port.js";
import type { ProviderMetadataPort } from "../ports/provider-metadata.port.js";

/**
 * Metadata passed per-call via providerOptions
 */
export interface ObservabilityMetadata {
  traceId: string;
  name?: string;
  metadata?: Record<string, unknown>;
}

export interface ObservabilityMiddlewareOptions {
  observability: ObservabilityPort;
  providerMetadata?: ProviderMetadataPort;
}

/**
 * Helper to create type-safe observability metadata for providerOptions
 */
export function withObservability(meta: ObservabilityMetadata): {
  observability: ObservabilityMetadata;
} {
  return { observability: meta };
}

/**
 * Creates middleware that sends generation data to an observability platform.
 */
export function createObservabilityMiddleware(
  options: ObservabilityMiddlewareOptions,
): LanguageModelMiddleware {
  const { observability, providerMetadata } = options;

  return {
    specificationVersion: "v3",
    wrapGenerate: async ({ doGenerate, params, model }) => {
      const startTime = new Date();
      const meta = params.providerOptions?.observability as ObservabilityMetadata | undefined;

      const result = await doGenerate();
      const endTime = new Date();

      if (meta?.traceId) {
        const extracted = providerMetadata?.extract(
          result.providerMetadata as Record<string, unknown> | undefined,
        );

        // Extract text from content
        const outputText = result.content
          .filter((c): c is { type: "text"; text: string } => c.type === "text")
          .map((c) => c.text)
          .join("");

        observability.generation({
          traceId: meta.traceId,
          name: meta.name ?? "generation",
          model: model.modelId,
          input: params.prompt,
          output: outputText,
          startTime,
          endTime,
          usage: extracted?.usage,
          cost: extracted?.cost,
          metadata: meta.metadata,
        });
      }

      return result;
    },

    wrapStream: async ({ doStream, params, model }) => {
      const startTime = new Date();
      const meta = params.providerOptions?.observability as ObservabilityMetadata | undefined;

      const result = await doStream();

      if (!meta?.traceId) {
        return result;
      }

      const chunks: string[] = [];

      const transformStream = new TransformStream<
        LanguageModelV3StreamPart,
        LanguageModelV3StreamPart
      >({
        transform(chunk, controller) {
          if (chunk.type === "text-delta") {
            chunks.push(chunk.delta);
          }
          controller.enqueue(chunk);
        },
        flush() {
          const endTime = new Date();

          observability.generation({
            traceId: meta.traceId,
            name: meta.name ?? "generation",
            model: model.modelId,
            input: params.prompt,
            output: chunks.join(""),
            startTime,
            endTime,
            metadata: meta.metadata,
          });
        },
      });

      return {
        specificationVersion: "v3",
        ...result,
        stream: result.stream.pipeThrough(transformStream),
      };
    },
  };
}
