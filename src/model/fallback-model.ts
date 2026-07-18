import {
    APICallError,
    type LanguageModelV4,
    type LanguageModelV4CallOptions,
} from '@ai-sdk/provider';
import type { LoggerPort } from '@jterrazz/telemetry';
import type { LanguageModel } from 'ai';

const RETRYABLE_MESSAGE_PATTERNS = [
    /ECONNREFUSED/i,
    /ECONNRESET/i,
    /ETIMEDOUT/i,
    /EAI_AGAIN/i,
    /ENOTFOUND/i,
    /timed?\s*out/i,
    /network/i,
    /fetch failed/i,
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

export interface FallbackModelOptions {
    primary: LanguageModel;
    fallback: LanguageModel;
    logger?: LoggerPort;
}

/**
 * Creates a `LanguageModelV4` that transparently falls back to a secondary
 * model when the primary model fails with a retryable error (HTTP 429, 5xx,
 * network errors/timeouts). Non-retryable errors (400s, validation, abort)
 * propagate unchanged.
 *
 * This is a model, not a middleware — middleware cannot switch the
 * underlying model, only transform a single model's behavior.
 *
 * @example
 * ```ts
 * const model = createFallbackModel({
 *   primary: provider.model('anthropic/claude-sonnet-4'),
 *   fallback: provider.model('openai/gpt-4o-mini'),
 *   logger,
 * });
 * ```
 */
export function createFallbackModel(options: FallbackModelOptions): LanguageModel {
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
                return fallbackModel.doGenerate(callOptions);
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
                return fallbackModel.doStream(callOptions);
            }
        },
    };

    return model;
}
