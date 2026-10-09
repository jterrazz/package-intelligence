import type { LanguageModelV4Content, LanguageModelV4StreamPart } from '@ai-sdk/provider';
import type { LoggerPort } from '@jterrazz/telemetry';
import type { LanguageModelMiddleware } from 'ai';

export type LoggingMiddlewareOptions = {
    logger: LoggerPort;
    include?: {
        params?: boolean;
        content?: boolean;
        usage?: boolean;
    };
};

type Include = Required<NonNullable<LoggingMiddlewareOptions['include']>>;

type Call = { kind: 'generate' | 'stream'; model: string; startedAt: number };

type Log = { include: Include; logger: LoggerPort };

function started(
    { include, logger }: Log,
    kind: Call['kind'],
    model: string,
    params: unknown,
): Call {
    logger.debug(`ai.${kind}.start`, { model, ...(include.params && { params }) });
    return { kind, model, startedAt: Date.now() };
}

function textOf(content: readonly LanguageModelV4Content[]): string {
    let text = '';
    for (const part of content) {
        if (part.type === 'text') {
            text += part.text;
        }
    }
    return text;
}

function elapsed(call: Call): { durationMs: number; model: string } {
    return { durationMs: Date.now() - call.startedAt, model: call.model };
}

function failed({ logger }: Log, call: Call, error: unknown): never {
    logger.error(`ai.${call.kind}.error`, {
        ...elapsed(call),
        // Stryker disable next-line ConditionalExpression,StringLiteral: the AI SDK raises an `Error` alone
        error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
}

function streamLogging(
    { include, logger }: Log,
    call: Call,
): TransformStream<LanguageModelV4StreamPart, LanguageModelV4StreamPart> {
    let text = '';
    return new TransformStream({
        flush() {
            logger.debug('ai.stream.complete', {
                ...elapsed(call),
                ...(include.content && { content: text }),
            });
        },
        transform(part, controller) {
            if (part.type === 'text-delta') {
                text += part.delta;
            }
            controller.enqueue(part);
        },
    });
}

/** Logs each AI SDK generation and stream through the given logger. */
export function createLoggingMiddleware(
    options: LoggingMiddlewareOptions,
): LanguageModelMiddleware {
    const log: Log = {
        include: {
            content: options.include?.content ?? false,
            params: options.include?.params ?? false,
            usage: options.include?.usage ?? true,
        },
        logger: options.logger,
    };

    return {
        // Stryker disable next-line StringLiteral: the AI SDK reads the version of a model, never of a middleware
        specificationVersion: 'v4',
        wrapGenerate: async ({ doGenerate, model, params }) => {
            const call = started(log, 'generate', model.modelId, params);
            try {
                const result = await doGenerate();
                log.logger.debug('ai.generate.complete', {
                    ...elapsed(call),
                    finishReason: result.finishReason,
                    ...(log.include.usage && { usage: result.usage }),
                    ...(log.include.content && { content: textOf(result.content) }),
                });
                return result;
            } catch (error) {
                return failed(log, call, error);
            }
        },

        wrapStream: async ({ doStream, model, params }) => {
            const call = started(log, 'stream', model.modelId, params);
            try {
                const result = await doStream();
                return { ...result, stream: result.stream.pipeThrough(streamLogging(log, call)) };
            } catch (error) {
                return failed(log, call, error);
            }
        },
    };
}
