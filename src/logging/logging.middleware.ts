import type { LanguageModelV3StreamPart } from "@ai-sdk/provider";
import type { LoggerPort } from "@jterrazz/logger";
import type { LanguageModelMiddleware } from "ai";

export interface LoggingMiddlewareOptions {
  logger: LoggerPort;
  include?: {
    params?: boolean;
    content?: boolean;
    usage?: boolean;
  };
}

/**
 * Creates middleware that logs AI SDK requests and responses.
 */
export function createLoggingMiddleware(
  options: LoggingMiddlewareOptions,
): LanguageModelMiddleware {
  const { logger, include = {} } = options;
  const { params: includeParams, content: includeContent, usage: includeUsage = true } = include;

  return {
    specificationVersion: "v3",
    wrapGenerate: async ({ doGenerate, params, model }) => {
      const startTime = Date.now();

      logger.debug("ai.generate.start", {
        model: model.modelId,
        ...(includeParams && { params }),
      });

      try {
        const result = await doGenerate();

        // Extract text from content
        const textContent = result.content
          .filter((c): c is { type: "text"; text: string } => c.type === "text")
          .map((c) => c.text)
          .join("");

        logger.debug("ai.generate.complete", {
          model: model.modelId,
          durationMs: Date.now() - startTime,
          finishReason: result.finishReason,
          ...(includeUsage && { usage: result.usage }),
          ...(includeContent && { content: textContent }),
        });

        return result;
      } catch (error) {
        logger.error("ai.generate.error", {
          model: model.modelId,
          durationMs: Date.now() - startTime,
          error: error instanceof Error ? error.message : "Unknown error",
        });
        throw error;
      }
    },

    wrapStream: async ({ doStream, params, model }) => {
      const startTime = Date.now();

      logger.debug("ai.stream.start", {
        model: model.modelId,
        ...(includeParams && { params }),
      });

      try {
        const result = await doStream();

        const chunks: string[] = [];

        const transformStream = new TransformStream<
          LanguageModelV3StreamPart,
          LanguageModelV3StreamPart
        >({
          transform(chunk, controller) {
            if (includeContent && chunk.type === "text-delta") {
              chunks.push(chunk.delta);
            }
            controller.enqueue(chunk);
          },
          flush() {
            logger.debug("ai.stream.complete", {
              model: model.modelId,
              durationMs: Date.now() - startTime,
              ...(includeContent && { content: chunks.join("") }),
            });
          },
        });

        return {
          ...result,
          stream: result.stream.pipeThrough(transformStream),
        };
      } catch (error) {
        logger.error("ai.stream.error", {
          model: model.modelId,
          durationMs: Date.now() - startTime,
          error: error instanceof Error ? error.message : "Unknown error",
        });
        throw error;
      }
    },
  };
}
