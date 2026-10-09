import type { LanguageModelV4StreamPart, LanguageModelV4Usage } from '@ai-sdk/provider';
import { trace } from '@opentelemetry/api';
import type { Span } from '@opentelemetry/api';
import type { LanguageModelMiddleware } from 'ai';

const COST_ATTRIBUTE = 'gen_ai.usage.cost';

type CostPricing = {
    /** USD per million input tokens */
    input: number;
    /** USD per million output tokens */
    output: number;
};

const REPORTED_COST_PATH = ['openrouter', 'usage', 'cost'];

function reportedCost(providerMetadata: unknown): number | undefined {
    let value = providerMetadata;
    for (const key of REPORTED_COST_PATH) {
        value = Reflect.get(new Object(value), key);
    }
    const cost = Number(value);
    return cost > 0 ? cost : undefined;
}

function resolveCost(
    providerMetadata: unknown,
    usage: LanguageModelV4Usage,
    pricing: CostPricing | undefined,
): number | undefined {
    const reported = reportedCost(providerMetadata);
    if (reported !== undefined || pricing === undefined) {
        return reported;
    }
    const inputTokens = usage.inputTokens.total ?? 0;
    const outputTokens = usage.outputTokens.total ?? 0;
    return (inputTokens * pricing.input + outputTokens * pricing.output) / 1_000_000;
}

function recordCost(span: Span | undefined, cost: number | undefined): void {
    // Stryker disable next-line ConditionalExpression: OpenTelemetry drops an attribute set to `undefined`, so writing one is writing none
    if (cost !== undefined) {
        span?.setAttribute(COST_ATTRIBUTE, cost);
    }
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
        // Stryker disable next-line StringLiteral: the AI SDK reads the version of a model, never of a middleware
        specificationVersion: 'v4',
        wrapGenerate: async ({ doGenerate }) => {
            const result = await doGenerate();
            recordCost(
                trace.getActiveSpan(),
                resolveCost(result.providerMetadata, result.usage, pricing),
            );
            return result;
        },

        wrapStream: async ({ doStream }) => {
            // invariant: the call's span ends with the finish part, outside this context: it is taken now and costed on that part.
            const span = trace.getActiveSpan();
            const result = await doStream();
            const costing = new TransformStream<
                LanguageModelV4StreamPart,
                LanguageModelV4StreamPart
            >({
                transform(part, controller) {
                    if (part.type === 'finish') {
                        recordCost(span, resolveCost(part.providerMetadata, part.usage, pricing));
                    }
                    controller.enqueue(part);
                },
            });
            return { ...result, stream: result.stream.pipeThrough(costing) };
        },
    };
}
