import type { LoggerPort } from '@jterrazz/logger';
import type { LanguageModelMiddleware } from 'ai';

export interface LoggingMiddlewareInclude {
    /** Include request params in logs */
    params?: boolean;
    /** Include response content in logs */
    content?: boolean;
    /** Include token usage in logs */
    usage?: boolean;
}

export interface LoggingMiddlewareOptions {
    logger: LoggerPort;
    /** Select which fields to include in logs (default: { usage: true }) */
    include?: LoggingMiddlewareInclude;
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
    const { logger, include = {} } = options;
    const { params: includeParams, content: includeContent, usage: includeUsage = true } = include;

    return {
        middlewareVersion: 'v2',

        wrapGenerate: async ({ doGenerate, params }) => {
            const startTime = Date.now();

            logger.debug('Model request started', {
                ...(includeParams && { params }),
            });

            try {
                const result = await doGenerate();

                logger.debug('Model request completed', {
                    durationMs: Date.now() - startTime,
                    finishReason: result.finishReason,
                    ...(includeUsage && { usage: result.usage }),
                    ...(includeContent && { content: result.content }),
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
                ...(includeParams && { params }),
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
