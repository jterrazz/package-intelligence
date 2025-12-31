import { describe, expect, it } from 'vitest';

import {
    classifyError,
    generationFailure,
    generationSuccess,
    isFailure,
    isSuccess,
    unwrap,
    unwrapOr,
} from '../result.js';

describe('generationSuccess', () => {
    it('creates a success result', () => {
        const result = generationSuccess({ name: 'test' });

        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data).toEqual({ name: 'test' });
        }
    });
});

describe('generationFailure', () => {
    it('creates a failure result', () => {
        const result = generationFailure('PARSING_FAILED', 'Invalid JSON');

        expect(result.success).toBe(false);
        if (!result.success) {
            expect(result.error.code).toBe('PARSING_FAILED');
            expect(result.error.message).toBe('Invalid JSON');
        }
    });

    it('includes cause when provided', () => {
        const cause = new Error('Original error');
        const result = generationFailure('AI_GENERATION_FAILED', 'Failed', cause);

        if (!result.success) {
            expect(result.error.cause).toBe(cause);
        }
    });
});

describe('classifyError', () => {
    it('classifies timeout errors', () => {
        expect(classifyError(new Error('Request timed out'))).toBe('TIMEOUT');
        expect(classifyError(new Error('timeout exceeded'))).toBe('TIMEOUT');
    });

    it('classifies rate limit errors', () => {
        expect(classifyError(new Error('Rate limit exceeded'))).toBe('RATE_LIMITED');
        expect(classifyError(new Error('Error 429: Too many requests'))).toBe('RATE_LIMITED');
    });

    it('classifies parsing errors', () => {
        expect(classifyError(new Error('Failed to parse JSON'))).toBe('PARSING_FAILED');
        expect(classifyError(new Error('Unexpected token'))).toBe('PARSING_FAILED');
    });

    it('classifies validation errors', () => {
        expect(classifyError(new Error('Schema validation failed'))).toBe('VALIDATION_FAILED');
        expect(classifyError(new Error('Zod error'))).toBe('VALIDATION_FAILED');
    });

    it('defaults to AI_GENERATION_FAILED', () => {
        expect(classifyError(new Error('Unknown error'))).toBe('AI_GENERATION_FAILED');
        expect(classifyError('string error')).toBe('AI_GENERATION_FAILED');
        expect(classifyError(null)).toBe('AI_GENERATION_FAILED');
    });
});

describe('isSuccess', () => {
    it('returns true for success results', () => {
        const result = generationSuccess('data');
        expect(isSuccess(result)).toBe(true);
    });

    it('returns false for failure results', () => {
        const result = generationFailure('TIMEOUT', 'timed out');
        expect(isSuccess(result)).toBe(false);
    });
});

describe('isFailure', () => {
    it('returns true for failure results', () => {
        const result = generationFailure('TIMEOUT', 'timed out');
        expect(isFailure(result)).toBe(true);
    });

    it('returns false for success results', () => {
        const result = generationSuccess('data');
        expect(isFailure(result)).toBe(false);
    });
});

describe('unwrap', () => {
    it('returns data for success results', () => {
        const result = generationSuccess({ value: 42 });
        expect(unwrap(result)).toEqual({ value: 42 });
    });

    it('throws for failure results', () => {
        const result = generationFailure('TIMEOUT', 'Request timed out');
        expect(() => unwrap(result)).toThrow('TIMEOUT: Request timed out');
    });
});

describe('unwrapOr', () => {
    it('returns data for success results', () => {
        const result = generationSuccess(42);
        expect(unwrapOr(result, 0)).toBe(42);
    });

    it('returns default for failure results', () => {
        const result = generationFailure<number>('TIMEOUT', 'timed out');
        expect(unwrapOr(result, 0)).toBe(0);
    });
});
