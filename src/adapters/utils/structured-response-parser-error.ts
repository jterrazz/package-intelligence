/**
 * Custom error for structured response parsing failures
 */
export class StructuredResponseParserError extends Error {
    constructor(
        message: string,
        public readonly cause?: unknown,
        public readonly text?: string,
    ) {
        super(message);
        this.name = 'StructuredResponseParserError';
    }
}
