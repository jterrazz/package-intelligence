import type { LanguageModelV2, SharedV2ProviderOptions } from "@ai-sdk/provider";
import { generateText } from "ai";
import type { Schema } from "zod";

import { parseObject, ParseObjectError } from "../parsing/parse-object.js";
import {
  classifyError,
  generationFailure,
  type GenerationResult,
  generationSuccess,
} from "../result/result.js";

export interface GenerateStructuredOptions<T> {
  /** The language model to use */
  model: LanguageModelV2;
  /** The prompt to send to the model */
  prompt: string;
  /** Optional system prompt */
  system?: string;
  /** Zod schema to validate and parse the response */
  schema: Schema<T>;
  /** Optional provider options (for observability, etc.) */
  providerOptions?: SharedV2ProviderOptions;
  /** Optional abort signal */
  abortSignal?: AbortSignal;
  /** Optional max tokens */
  maxOutputTokens?: number;
  /** Optional temperature */
  temperature?: number;
}

/**
 * Generate structured data from an AI model with automatic parsing and error handling.
 * Combines generateText + parseObject + error classification into a single function.
 *
 * @example
 * ```typescript
 * const result = await generateStructured({
 *   model,
 *   prompt: "Analyze this article...",
 *   schema: z.object({ sentiment: z.string(), score: z.number() }),
 *   providerOptions: withObservability({ traceId: "..." }),
 * });
 *
 * if (result.success) {
 *   console.log(result.data.sentiment);
 * } else {
 *   console.error(result.error.code, result.error.message);
 * }
 * ```
 */
export async function generateStructured<T>(
  options: GenerateStructuredOptions<T>,
): Promise<GenerationResult<T>> {
  const {
    model,
    prompt,
    system,
    schema,
    providerOptions,
    abortSignal,
    maxOutputTokens,
    temperature,
  } = options;

  try {
    const response = await generateText({
      model,
      prompt,
      system,
      providerOptions,
      abortSignal,
      maxOutputTokens,
      temperature,
    });

    if (!response.text || response.text.trim() === "") {
      return generationFailure("EMPTY_RESULT", "AI returned empty response");
    }

    try {
      const data = parseObject(response.text, schema);
      return generationSuccess(data);
    } catch (error) {
      if (error instanceof ParseObjectError) {
        return generationFailure("PARSING_FAILED", error.message, error);
      }
      return generationFailure("VALIDATION_FAILED", "Schema validation failed", error);
    }
  } catch (error) {
    const code = classifyError(error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return generationFailure(code, message, error);
  }
}
