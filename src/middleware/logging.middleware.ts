import type { LoggerPort } from '@jterrazz/logger';
import type { LanguageModelMiddleware } from 'ai';

export interface LoggingMiddlewareOptions {
    logger: LoggerPort;
    /** Include request/response details in logs (default: false) */
    verbose?: boolean;
}

/**
 * Creates AI SDK middleware that logs model requests and responses.
 *
 * @example
 * ```ts
 * import { wrapLanguageModel } from 'ai';
 *
 * const model = wrapLanguageModel({
 *   model: openrouter('anthropic/claude-sonnet-4-20250514'),
 *   middleware: createLoggingMiddleware({ logger }),
 * });
 * ```
 */
export function createLoggingMiddleware(
    options: LoggingMiddlewareOptions,
): LanguageModelMiddleware {
    const { logger, verbose = false } = options;

    return {
        middlewareVersion: 'v2',

        wrapGenerate: async ({ doGenerate, params }) => {
            const startTime = Date.now();

            logger.debug('Model request started', {
                ...(verbose && { params }),
            });

            try {
                const result = await doGenerate();

                logger.debug('Model request completed', {
                    durationMs: Date.now() - startTime,
                    finishReason: result.finishReason,
                    usage: result.usage,
                    ...(verbose && { content: result.content }),
                });

                return result;
            } catch (error) {
                logger.error('Model request failed', {
                    durationMs: Date.now() - startTime,
                    error: error instanceof Error ? error.message : 'Unknown error',
                });
                throw error;
            }
        },

        wrapStream: async ({ doStream, params }) => {
            const startTime = Date.now();

            logger.debug('Model stream started', {
                ...(verbose && { params }),
            });

            try {
                const result = await doStream();

                return {
                    ...result,
                    stream: result.stream,
                };
            } catch (error) {
                logger.error('Model stream failed', {
                    durationMs: Date.now() - startTime,
                    error: error instanceof Error ? error.message : 'Unknown error',
                });
                throw error;
            }
        },
    };
}
