import { OpenTelemetry } from '@ai-sdk/otel';
import type { LanguageModelV4 } from '@ai-sdk/provider';
import type { LoggerPort } from '@jterrazz/telemetry';
import { type LanguageModel, registerTelemetry, wrapLanguageModel } from 'ai';

import { createCostMiddleware } from '../middleware/cost.middleware.js';
import { createLoggingMiddleware } from '../middleware/logging.middleware.js';
import { createFallbackModel } from '../model/fallback-model.js';
import { createGatewayProvider, type GatewayConfig } from '../provider/gateway.provider.js';
import {
    createOpenRouterProvider,
    type OpenRouterConfig,
} from '../provider/openrouter.provider.js';

type ProviderConfig =
    | (GatewayConfig & { type: 'gateway' })
    | (OpenRouterConfig & { type: 'openrouter' });

interface ResolvedProvider {
    model: (id: string) => LanguageModel;
}

let telemetryRegistered = false;

/**
 * Registers the AI SDK OpenTelemetry integration, once per process. Best
 * effort — if the host app has no OTel SDK configured, `@ai-sdk/otel` spans
 * are simply dropped rather than throwing.
 */
function ensureTelemetryRegistered(): void {
    if (telemetryRegistered) {
        return;
    }
    telemetryRegistered = true;

    try {
        registerTelemetry(new OpenTelemetry());
    } catch {
        // Best-effort: telemetry registration must never break the app.
    }
}

function createProvider(config: ProviderConfig): ResolvedProvider {
    switch (config.type) {
        case 'gateway': {
            return createGatewayProvider(config);
        }
        case 'openrouter': {
            return createOpenRouterProvider(config);
        }
    }
}

function assertProviderExists(
    providerKey: string,
    providers: Record<string, ProviderConfig>,
): void {
    if (providers[providerKey]) {
        return;
    }
    const available = Object.keys(providers).join(', ') || '(none configured)';
    throw new Error(`Unknown provider "${providerKey}". Available providers: ${available}.`);
}

export type { ProviderConfig };

export interface ModelRef {
    /** Key into `providers` */
    provider: string;
    /** Technical model id passed through to the provider as-is */
    model: string;
}

export interface AgentConfig extends ModelRef {
    /** Model used when the primary `provider`/`model` fails with a retryable error */
    fallback?: ModelRef;
}

export interface IntelligenceConfig {
    providers: Record<string, ProviderConfig>;
    agents: Record<string, AgentConfig>;
    /**
     * USD-per-million-token pricing, keyed by `"<provider>/<model>"` (the
     * agent's `provider` and `model` joined with `/`, not a provider-side
     * identifier).
     */
    pricing?: Record<string, { input: number; output: number }>;
    logger?: LoggerPort;
}

export interface Intelligence {
    /** Get the composed language model for the given agent name */
    model: (agentName: string) => LanguageModel;
}

/**
 * Creates a composition root over AI SDK v7: resolves each agent's
 * `provider`/`model` pair into a fully instrumented `LanguageModel` — cost
 * tracking, optional fallback, and optional logging — cached per agent name.
 *
 * Registers the `@ai-sdk/otel` telemetry integration on first use (idempotent,
 * best-effort). The host app is expected to have already registered an
 * OpenTelemetry Node SDK (e.g. via `@jterrazz/telemetry`).
 *
 * @example
 * ```ts
 * const intelligence = createIntelligence({
 *   providers: {
 *     openrouter: { type: 'openrouter', apiKey: process.env.OPENROUTER_API_KEY },
 *   },
 *   agents: {
 *     summarizer: {
 *       provider: 'openrouter',
 *       model: 'google/gemini-2.5-flash-lite',
 *       fallback: { provider: 'openrouter', model: 'openai/gpt-4o-mini' },
 *     },
 *   },
 *   pricing: {
 *     'openrouter/google/gemini-2.5-flash-lite': { input: 0.1, output: 0.4 },
 *   },
 *   logger,
 * });
 *
 * const model = intelligence.model('summarizer');
 * const { text } = await generateText({ model, prompt: 'Hello!' });
 * ```
 */
export function createIntelligence(config: IntelligenceConfig): Intelligence {
    ensureTelemetryRegistered();

    const { agents, logger, pricing, providers } = config;

    const providerCache = new Map<string, ResolvedProvider>();
    const modelCache = new Map<string, LanguageModel>();

    function resolveProvider(providerKey: string): ResolvedProvider {
        let provider = providerCache.get(providerKey);
        if (!provider) {
            provider = createProvider(providers[providerKey]);
            providerCache.set(providerKey, provider);
        }
        return provider;
    }

    function buildModel(ref: ModelRef): LanguageModel {
        assertProviderExists(ref.provider, providers);

        const provider = resolveProvider(ref.provider);
        const baseModel = provider.model(ref.model) as LanguageModelV4;
        const pricingKey = `${ref.provider}/${ref.model}`;

        return wrapLanguageModel({
            model: baseModel,
            middleware: [
                createCostMiddleware({ modelRef: pricingKey, pricing: pricing?.[pricingKey] }),
            ],
        });
    }

    function buildAgentModel(agentName: string): LanguageModel {
        const agentConfig = agents[agentName];
        if (!agentConfig) {
            const available = Object.keys(agents).join(', ') || '(none configured)';
            throw new Error(`Unknown agent "${agentName}". Available agents: ${available}.`);
        }

        const primary = buildModel({ model: agentConfig.model, provider: agentConfig.provider });
        const composed = agentConfig.fallback
            ? createFallbackModel({
                  fallback: buildModel(agentConfig.fallback),
                  logger,
                  primary,
              })
            : primary;

        if (!logger) {
            return composed;
        }

        return wrapLanguageModel({
            model: composed as LanguageModelV4,
            middleware: [createLoggingMiddleware({ logger })],
        });
    }

    return {
        model(agentName: string): LanguageModel {
            let model = modelCache.get(agentName);
            if (!model) {
                model = buildAgentModel(agentName);
                modelCache.set(agentName, model);
            }
            return model;
        },
    };
}
