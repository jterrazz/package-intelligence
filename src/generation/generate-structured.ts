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
  model: LanguageModelV2;
  prompt: string;
  system?: string;
  schema: Schema<T>;
  providerOptions?: SharedV2ProviderOptions;
  abortSignal?: AbortSignal;
  maxOutputTokens?: number;
  temperature?: number;
}

/**
 * Generate structured data from an AI model with automatic parsing and error handling.
 * Observability is handled by middleware - no metadata exposed to caller.
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
