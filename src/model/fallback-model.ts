import { APICallError } from '@ai-sdk/provider';
import type { LanguageModelV4, LanguageModelV4CallOptions } from '@ai-sdk/provider';
import type { LoggerPort } from '@jterrazz/telemetry';
import type { LanguageModel } from 'ai';

const RETRYABLE_MESSAGE_PATTERNS = [
    /ECONNREFUSED/iu,
    /ECONNRESET/iu,
    /ETIMEDOUT/iu,
    /EAI_AGAIN/iu,
    /ENOTFOUND/iu,
    /timed?\s*out/iu,
    /network/iu,
    /fetch failed/iu,
];

function isRetryableError(error: unknown): boolean {
    if (APICallError.isInstance(error)) {
        if (typeof error.statusCode === 'number') {
            return error.statusCode === 429 || error.statusCode >= 500;
        }
        return error.isRetryable;
    }

    const message = error instanceof Error ? error.message : String(error);
    return RETRYABLE_MESSAGE_PATTERNS.some((pattern) => pattern.test(message));
}

export type FallbackModelOptions = {
    primary: LanguageModel;
    fallback: LanguageModel;
    logger?: LoggerPort;
};

/** A model that answers from `fallback` when `primary` fails with a retryable error (429, 5xx, network). */
export function createFallbackModel(options: FallbackModelOptions): LanguageModelV4 {
    const { primary, fallback, logger } = options;
    const primaryModel = primary as LanguageModelV4;
    const fallbackModel = fallback as LanguageModelV4;

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
