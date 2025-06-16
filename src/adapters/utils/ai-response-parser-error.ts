/**
 * Custom error for AI response parsing failures
 */
export class AIResponseParserError extends Error {
    constructor(
        message: string,
        public readonly cause?: unknown,
        public readonly text?: string,
    ) {
        super(message);
        this.name = 'AIResponseParserError';
    }
}
