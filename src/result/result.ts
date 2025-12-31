/**
 * Error codes for AI generation failures
 */
export type GenerationErrorCode =
  | "AI_GENERATION_FAILED"
  | "EMPTY_RESULT"
  | "PARSING_FAILED"
  | "RATE_LIMITED"
  | "TIMEOUT"
  | "VALIDATION_FAILED";

/**
 * Structured error information from AI generation
 */
export interface GenerationError {
  code: GenerationErrorCode;
  message: string;
  cause?: unknown;
}

/**
 * Discriminated union result type for AI operations.
 * Forces explicit handling of both success and failure cases.
 */
export type GenerationResult<T> =
  | { success: false; error: GenerationError }
  | { success: true; data: T };

/**
 * Create a successful result
 */
export function generationSuccess<T>(data: T): GenerationResult<T> {
  return { success: true, data };
}

/**
 * Create a failed result
 */
export function generationFailure<T>(
  code: GenerationErrorCode,
  message: string,
  cause?: unknown,
): GenerationResult<T> {
  return { success: false, error: { code, message, cause } };
}

/**
 * Classify an error into a GenerationErrorCode
 */
export function classifyError(error: unknown): GenerationErrorCode {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();

    if (message.includes("timeout") || message.includes("timed out")) {
      return "TIMEOUT";
    }
    if (message.includes("rate limit") || message.includes("429")) {
      return "RATE_LIMITED";
    }
    if (
      message.includes("parse") ||
      message.includes("json") ||
      message.includes("unexpected token")
    ) {
      return "PARSING_FAILED";
    }
    if (message.includes("valid") || message.includes("schema") || message.includes("zod")) {
      return "VALIDATION_FAILED";
    }
  }

  return "AI_GENERATION_FAILED";
}

/**
 * Check if a result is successful (type guard)
 */
export function isSuccess<T>(result: GenerationResult<T>): result is { success: true; data: T } {
  return result.success;
}

/**
 * Check if a result is a failure (type guard)
 */
export function isFailure<T>(
  result: GenerationResult<T>,
): result is { success: false; error: GenerationError } {
  return !result.success;
}

/**
 * Unwrap a result, throwing if it fails
 */
export function unwrap<T>(result: GenerationResult<T>): T {
  if (result.success) {
    return result.data;
  }
  throw new Error(`${result.error.code}: ${result.error.message}`);
}

/**
 * Unwrap a result with a default value for failures
 */
export function unwrapOr<T>(result: GenerationResult<T>, defaultValue: T): T {
  return result.success ? result.data : defaultValue;
}
