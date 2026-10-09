import { OpenTelemetry } from '@ai-sdk/otel';
import type { LanguageModelV4 } from '@ai-sdk/provider';
import type { LoggerPort } from '@jterrazz/telemetry';
import { registerTelemetry, wrapLanguageModel } from 'ai';

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
    model: (id: string) => LanguageModelV4;
};

let telemetryRegistered = false;

function ensureTelemetryRegistered(): void {
    if (telemetryRegistered) {
        return;
    }
    // Stryker disable next-line BooleanLiteral: a second registration traces nothing twice; the flag keeps the process's list of integrations from growing with each factory
    telemetryRegistered = true;
    registerTelemetry(new OpenTelemetry());
}

function createProvider(config: ProviderConfig): ResolvedProvider {
    return config.type === 'gateway'
        ? createGatewayProvider(config)
        : createOpenRouterProvider(config);
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
    model: (agentName: string) => LanguageModelV4;
};

type Resolution = Omit<IntelligenceConfig, 'providers'> & {
    provider: (key: string) => ResolvedProvider;
};

function buildModel(resolution: Resolution, ref: ModelRef, agentName: string): LanguageModelV4 {
    const pricing = resolution.pricing?.[`${ref.provider}/${ref.model}`];
    return wrapLanguageModel({
        middleware: [
            createAgentMiddleware({ agentName }),
            createCostMiddleware(pricing ? { pricing } : {}),
        ],
        model: resolution.provider(ref.provider).model(ref.model),
    });
}

function buildAgentModel(resolution: Resolution, agentName: string): LanguageModelV4 {
    const agent = resolution.agents[agentName];
    if (!agent) {
        const available = Object.keys(resolution.agents).join(', ') || '(none configured)';
        throw new Error(`Unknown agent "${agentName}". Available agents: ${available}.`);
    }
    const { logger } = resolution;
    const primary = buildModel(resolution, agent, agentName);
    const composed = agent.fallback
        ? createFallbackModel({
              fallback: buildModel(resolution, agent.fallback, agentName),
              primary,
              ...(logger ? { logger } : {}),
          })
        : primary;
    return logger
        ? wrapLanguageModel({ middleware: [createLoggingMiddleware({ logger })], model: composed })
        : composed;
}

/** Resolves each agent's provider and model into an instrumented language model, cached per agent. */
export function createIntelligence(config: IntelligenceConfig): Intelligence {
    ensureTelemetryRegistered();
    const models = new Map<string, LanguageModelV4>();
    const resolution: Resolution = {
        ...config,
        provider: (key) => createProvider(requireProviderConfig(key, config.providers)),
    };
    return {
        model(agentName) {
            const model = models.get(agentName) ?? buildAgentModel(resolution, agentName);
            models.set(agentName, model);
            return model;
        },
    };
}
