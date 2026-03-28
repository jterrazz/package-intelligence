import { describe, expect, test } from "vitest";

import {
  classifyError,
  generationFailure,
  generationSuccess,
  isFailure,
  isSuccess,
  unwrap,
  unwrapOr,
} from "./result.js";

describe("generationSuccess", () => {
  test("creates a success result", () => {
    // Given -- a data object
    const result = generationSuccess({ name: "test" });

    // Then -- the result is a success with the data
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({ name: "test" });
    }
  });
});

describe("generationFailure", () => {
  test("creates a failure result", () => {
    // Given -- an error code and message
    const result = generationFailure("PARSING_FAILED", "Invalid JSON");

    // Then -- the result is a failure with the error details
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("PARSING_FAILED");
      expect(result.error.message).toBe("Invalid JSON");
    }
  });

  test("includes cause when provided", () => {
    // Given -- a failure with a cause error
    const cause = new Error("Original error");
    const result = generationFailure("AI_GENERATION_FAILED", "Failed", cause);

    // Then -- the cause is included in the error
    if (!result.success) {
      expect(result.error.cause).toBe(cause);
    }
  });
});

describe("classifyError", () => {
  test("classifies timeout errors", () => {
    // Given -- errors with timeout-related messages
    // Then -- they are classified as TIMEOUT
    expect(classifyError(new Error("Request timed out"))).toBe("TIMEOUT");
    expect(classifyError(new Error("timeout exceeded"))).toBe("TIMEOUT");
  });

  test("classifies rate limit errors", () => {
    // Given -- errors with rate limit messages
    // Then -- they are classified as RATE_LIMITED
    expect(classifyError(new Error("Rate limit exceeded"))).toBe("RATE_LIMITED");
    expect(classifyError(new Error("Error 429: Too many requests"))).toBe("RATE_LIMITED");
  });

  test("classifies parsing errors", () => {
    // Given -- errors with parsing-related messages
    // Then -- they are classified as PARSING_FAILED
    expect(classifyError(new Error("Failed to parse JSON"))).toBe("PARSING_FAILED");
    expect(classifyError(new Error("Unexpected token"))).toBe("PARSING_FAILED");
  });

  test("classifies validation errors", () => {
    // Given -- errors with validation-related messages
    // Then -- they are classified as VALIDATION_FAILED
    expect(classifyError(new Error("Schema validation failed"))).toBe("VALIDATION_FAILED");
    expect(classifyError(new Error("Zod error"))).toBe("VALIDATION_FAILED");
  });

  test("defaults to AI_GENERATION_FAILED", () => {
    // Given -- errors with unrecognized messages or non-Error types
    // Then -- they default to AI_GENERATION_FAILED
    expect(classifyError(new Error("Unknown error"))).toBe("AI_GENERATION_FAILED");
    expect(classifyError("string error")).toBe("AI_GENERATION_FAILED");
    expect(classifyError(null)).toBe("AI_GENERATION_FAILED");
  });
});

describe("isSuccess", () => {
  test("returns true for success results", () => {
    // Given -- a success result
    const result = generationSuccess("data");

    // Then -- isSuccess returns true
    expect(isSuccess(result)).toBe(true);
  });

  test("returns false for failure results", () => {
    // Given -- a failure result
    const result = generationFailure("TIMEOUT", "timed out");

    // Then -- isSuccess returns false
    expect(isSuccess(result)).toBe(false);
  });
});

describe("isFailure", () => {
  test("returns true for failure results", () => {
    // Given -- a failure result
    const result = generationFailure("TIMEOUT", "timed out");

    // Then -- isFailure returns true
    expect(isFailure(result)).toBe(true);
  });

  test("returns false for success results", () => {
    // Given -- a success result
    const result = generationSuccess("data");

    // Then -- isFailure returns false
    expect(isFailure(result)).toBe(false);
  });
});

describe("unwrap", () => {
  test("returns data for success results", () => {
    // Given -- a success result with data
    const result = generationSuccess({ value: 42 });

    // Then -- unwrap returns the data
    expect(unwrap(result)).toEqual({ value: 42 });
  });

  test("throws for failure results", () => {
    // Given -- a failure result
    const result = generationFailure("TIMEOUT", "Request timed out");

    // Then -- unwrap throws with error details
    expect(() => unwrap(result)).toThrow("TIMEOUT: Request timed out");
  });
});

describe("unwrapOr", () => {
  test("returns data for success results", () => {
    // Given -- a success result
    const result = generationSuccess(42);

    // Then -- unwrapOr returns the data
    expect(unwrapOr(result, 0)).toBe(42);
  });

  test("returns default for failure results", () => {
    // Given -- a failure result
    const result = generationFailure<number>("TIMEOUT", "timed out");

    // Then -- unwrapOr returns the default value
    expect(unwrapOr(result, 0)).toBe(0);
  });
});
