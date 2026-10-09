import type { LanguageModelV4, LanguageModelV4CallOptions } from '@ai-sdk/provider';
import type { LoggerPort } from '@jterrazz/telemetry';
import { APICallError } from 'ai';

// outside: the providers' SDKs raise every call's failure as an `APICallError`, retryable on a 408, 409, 429, 5xx or a network failure.
function isRetryableError(error: unknown): boolean {
    // Stryker disable next-line ConditionalExpression: any other error carries no `isRetryable`, so it reads as not retryable either way
    return APICallError.isInstance(error) && error.isRetryable;
}

export type FallbackModelOptions = {
    primary: LanguageModelV4;
    fallback: LanguageModelV4;
    logger?: LoggerPort;
};

/** A model that answers from `fallback` when `primary` fails with a retryable error (408, 409, 429, 5xx, a network failure). */
export function createFallbackModel(options: FallbackModelOptions): LanguageModelV4 {
    const { fallback: fallbackModel, logger, primary: primaryModel } = options;

    function logFallback(error: unknown): void {
        logger?.warn('ai.fallback.triggered', {
            modelIds: [primaryModel.modelId, fallbackModel.modelId],
            error: error instanceof Error ? error.message : String(error),
        });
    }

    const model: LanguageModelV4 = {
        specificationVersion: 'v4',
        provider: primaryModel.provider,
        modelId: primaryModel.modelId,
        supportedUrls: primaryModel.supportedUrls,

        async doGenerate(callOptions: LanguageModelV4CallOptions) {
            try {
                return await primaryModel.doGenerate(callOptions);
            } catch (error) {
                if (!isRetryableError(error)) {
                    throw error;
                }
                logFallback(error);
                return await fallbackModel.doGenerate(callOptions);
            }
        },

        async doStream(callOptions: LanguageModelV4CallOptions) {
            try {
                return await primaryModel.doStream(callOptions);
            } catch (error) {
                if (!isRetryableError(error)) {
                    throw error;
                }
                logFallback(error);
                return await fallbackModel.doStream(callOptions);
            }
        },
    };

    return model;
}
