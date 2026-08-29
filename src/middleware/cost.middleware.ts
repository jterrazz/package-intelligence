import type { LanguageModelV4StreamPart, LanguageModelV4Usage } from '@ai-sdk/provider';
import { trace } from '@opentelemetry/api';
import type { LanguageModelMiddleware } from 'ai';

const COST_ATTRIBUTE = 'gen_ai.usage.cost';

interface OpenRouterCostMetadata {
    openrouter?: {
        usage?: {
            cost?: number;
        };
    };
}

interface CostPricing {
    /** USD per million input tokens */
    input: number;
    /** USD per million output tokens */
    output: number;
}

function resolveCost(
    providerMetadata: Record<string, unknown> | undefined,
    usage: LanguageModelV4Usage | undefined,
    pricing: CostPricing | undefined,
): number | undefined {
    const actualCost = (providerMetadata as OpenRouterCostMetadata | undefined)?.openrouter?.usage
        ?.cost;
    if (typeof actualCost === 'number' && actualCost > 0) {
        return actualCost;
    }

    if (pricing) {
        const inputTokens = usage?.inputTokens?.total ?? 0;
        const outputTokens = usage?.outputTokens?.total ?? 0;
        return (
            (inputTokens / 1_000_000) * pricing.input + (outputTokens / 1_000_000) * pricing.output
        );
    }

    return undefined;
}

function recordCost(cost: number | undefined): void {
    if (cost === undefined) {
        return;
    }
    trace.getActiveSpan()?.setAttribute(COST_ATTRIBUTE, cost);
}

export type { CostPricing };

export interface CostMiddlewareOptions {
    /** Fallback USD-per-million-token pricing, used when the provider doesn't report actual cost */
    pricing?: CostPricing;
}

/**
 * Creates middleware that records the USD cost of a generation as
 * `gen_ai.usage.cost` on the active OpenTelemetry span — the AI SDK's own
 * inference span (`gen_ai.operation.name = chat`), which is what Langfuse
 * ingests as a generation.
 *
 * Resolution order:
 * 1. Actual cost reported by the provider (currently: OpenRouter's
 *    `providerMetadata.openrouter.usage.cost`).
 * 2. Estimated cost from `pricing` (USD per million input/output tokens),
 *    computed from the reported token usage.
 *
 * When neither is available nothing is written: `gen_ai.request.model` is
 * left to the AI SDK (the bare model id), so Langfuse can still price the
 * generation from its own model catalogue. Langfuse prioritizes
 * `gen_ai.usage.cost` over that inference when both exist.
 *
 * Never throws: all enrichment is best-effort.
 *
 * @example
 * ```ts
 * const model = wrapLanguageModel({
 *   model: provider.model('google/gemini-2.5-flash-lite'),
 *   middleware: [createCostMiddleware({ pricing: { input: 0.1, output: 0.4 } })],
 * });
 * ```
 */
export function createCostMiddleware(options: CostMiddlewareOptions = {}): LanguageModelMiddleware {
    const { pricing } = options;

    return {
        specificationVersion: 'v4',
        wrapGenerate: async ({ doGenerate }) => {
            const result = await doGenerate();

            try {
                recordCost(
                    resolveCost(
                        result.providerMetadata as Record<string, unknown> | undefined,
                        result.usage,
                        pricing,
                    ),
                );
            } catch {
                // Best-effort: telemetry enrichment must never break generation.
            }

            return result;
        },

        wrapStream: async ({ doStream }) => {
            const result = await doStream();

            let finishUsage: LanguageModelV4Usage | undefined;
            let finishProviderMetadata: Record<string, unknown> | undefined;

            const transformStream = new TransformStream<
                LanguageModelV4StreamPart,
                LanguageModelV4StreamPart
            >({
                transform(chunk, controller) {
                    if (chunk.type === 'finish') {
                        finishUsage = chunk.usage;
                        finishProviderMetadata = chunk.providerMetadata as
                            | Record<string, unknown>
                            | undefined;
                    }
                    controller.enqueue(chunk);
                },
                flush() {
                    try {
                        recordCost(resolveCost(finishProviderMetadata, finishUsage, pricing));
                    } catch {
                        // Best-effort: telemetry enrichment must never break generation.
                    }
                },
            });

            return {
                ...result,
                stream: result.stream.pipeThrough(transformStream),
            };
        },
    };
}
