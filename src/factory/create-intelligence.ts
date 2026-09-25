import { OpenTelemetry } from '@ai-sdk/otel';
import type { LanguageModelV4 } from '@ai-sdk/provider';
import type { LoggerPort } from '@jterrazz/telemetry';
import { registerTelemetry, wrapLanguageModel } from 'ai';
import type { LanguageModel } from 'ai';

import { createAgentMiddleware } from '../middleware/agent.middleware.js';
import { createCostMiddleware } from '../middleware/cost.middleware.js';
import { createLoggingMiddleware } from '../middleware/logging.middleware.js';
import { createFallbackModel } from '../model/fallback-model.js';
import { createGatewayProvider } from '../provider/gateway.provider.js';
import type { GatewayConfig } from '../provider/gateway.provider.js';
import { createOpenRouterProvider } from '../provider/openrouter.provider.js';
import type { OpenRouterConfig } from '../provider/openrouter.provider.js';

type ProviderConfig =
    | (GatewayConfig & { type: 'gateway' })
    | (OpenRouterConfig & { type: 'openrouter' });

type ResolvedProvider = {
    model: (id: string) => LanguageModel;
};

let telemetryRegistered = false;

function ensureTelemetryRegistered(): void {
    if (telemetryRegistered) {
        return;
    }
    telemetryRegistered = true;

    try {
        registerTelemetry(new OpenTelemetry());
    } catch {
        // best-effort
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
        default: {
            throw new Error(`Unknown provider type "${String(config)}".`);
        }
    }
}

function requireProviderConfig(
    providerKey: string,
    providers: Record<string, ProviderConfig>,
): ProviderConfig {
    const config = providers[providerKey];
    if (config) {
        return config;
    }
    const available = Object.keys(providers).join(', ') || '(none configured)';
    throw new Error(`Unknown provider "${providerKey}". Available providers: ${available}.`);
}

export type { ProviderConfig };

export type ModelRef = {
    /** Key into `providers` */
    provider: string;
    /** Technical model id passed through to the provider as-is */
    model: string;
};

export type AgentConfig = ModelRef & {
    /** Model used when the primary `provider`/`model` fails with a retryable error */
    fallback?: ModelRef;
};

export type IntelligenceConfig = {
    providers: Record<string, ProviderConfig>;
    agents: Record<string, AgentConfig>;
    /** USD per million tokens, keyed by `"<provider>/<model>"` as the agent config names them. */
    pricing?: Record<string, { input: number; output: number }>;
    logger?: LoggerPort;
};

export type Intelligence = {
    model: (agentName: string) => LanguageModel;
};

/** Resolves each agent's provider and model into an instrumented `LanguageModel`, cached per agent. */
export function createIntelligence(config: IntelligenceConfig): Intelligence {
    ensureTelemetryRegistered();

    const { agents, logger, pricing, providers } = config;

    const providerCache = new Map<string, ResolvedProvider>();
    const modelCache = new Map<string, LanguageModel>();

    function resolveProvider(providerKey: string): ResolvedProvider {
        let provider = providerCache.get(providerKey);
        if (!provider) {
            provider = createProvider(requireProviderConfig(providerKey, providers));
            providerCache.set(providerKey, provider);
        }
        return provider;
    }

    function buildModel(ref: ModelRef, agentName: string): LanguageModel {
        const provider = resolveProvider(ref.provider);
        const baseModel = provider.model(ref.model) as LanguageModelV4;
        const modelPricing = pricing?.[`${ref.provider}/${ref.model}`];

        return wrapLanguageModel({
            model: baseModel,
            middleware: [
                createAgentMiddleware({ agentName }),
                createCostMiddleware(modelPricing ? { pricing: modelPricing } : {}),
            ],
        });
    }

    function buildAgentModel(agentName: string): LanguageModel {
        const agentConfig = agents[agentName];
        if (!agentConfig) {
            const available = Object.keys(agents).join(', ') || '(none configured)';
            throw new Error(`Unknown agent "${agentName}". Available agents: ${available}.`);
        }

        const primary = buildModel(
            { model: agentConfig.model, provider: agentConfig.provider },
            agentName,
        );
        const composed = agentConfig.fallback
            ? createFallbackModel({
                  fallback: buildModel(agentConfig.fallback, agentName),
                  primary,
                  ...(logger ? { logger } : {}),
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
            if (model === undefined) {
                model = buildAgentModel(agentName);
                modelCache.set(agentName, model);
            }
            return model;
        },
    };
}
