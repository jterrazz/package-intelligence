// Factory
export {
    type AgentConfig,
    createIntelligence,
    type Intelligence,
    type IntelligenceConfig,
    type ProviderConfig,
} from './factory/create-intelligence.js';

// Middleware
export {
    type CostMiddlewareOptions,
    type CostPricing,
    createCostMiddleware,
} from './middleware/cost.middleware.js';
export {
    createLoggingMiddleware,
    type LoggingMiddlewareOptions,
} from './middleware/logging.middleware.js';
export { createSchemaInstructionMiddleware } from './middleware/schema-instruction.middleware.js';

// Model
export { createFallbackModel, type FallbackModelOptions } from './model/fallback-model.js';

// Provider - OpenRouter
export {
    createOpenRouterProvider,
    type OpenRouterConfig,
    type OpenRouterMetadata,
    type OpenRouterProvider,
} from './provider/openrouter.provider.js';

// Provider - Gateway
export {
    createGatewayProvider,
    type GatewayConfig,
    type GatewayProvider,
} from './provider/gateway.provider.js';
