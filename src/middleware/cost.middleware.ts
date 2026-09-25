import type { LanguageModelV4StreamPart, LanguageModelV4Usage } from '@ai-sdk/provider';
import { trace } from '@opentelemetry/api';
import type { LanguageModelMiddleware } from 'ai';

const COST_ATTRIBUTE = 'gen_ai.usage.cost';

type OpenRouterCostMetadata = {
    openrouter?: {
        usage?: {
            cost?: number;
        };
    };
};

type CostPricing = {
    /** USD per million input tokens */
    input: number;
    /** USD per million output tokens */
    output: number;
};

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

export type CostMiddlewareOptions = {
    /** Fallback USD-per-million-token pricing, used when the provider doesn't report actual cost */
    pricing?: CostPricing;
};

/** Records a generation's USD cost on the active span: the provider's reported cost, else an estimate from `pricing`. */
export function createCostMiddleware(options: CostMiddlewareOptions = {}): LanguageModelMiddleware {
    const { pricing } = options;

    return {
        specificationVersion: 'v4',
        wrapGenerate: async ({ doGenerate }) => {
            const result = await doGenerate();

            try {
                recordCost(resolveCost(result.providerMetadata, result.usage, pricing));
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
                        finishProviderMetadata = chunk.providerMetadata;
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
