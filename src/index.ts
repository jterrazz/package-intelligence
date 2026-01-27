// Logging
export {
  createLoggingMiddleware,
  type LoggingMiddlewareOptions,
} from "./logging/logging.middleware.js";

// Observability
export {
  createObservabilityMiddleware,
  type ObservabilityMetadata,
  type ObservabilityMiddlewareOptions,
  withObservability,
} from "./observability/observability.middleware.js";
export { LangfuseAdapter, type LangfuseConfig } from "./observability/langfuse.adapter.js";
export { NoopObservabilityAdapter } from "./observability/noop.adapter.js";

// Ports
export {
  type CostDetails,
  type GenerationParams,
  type ObservabilityPort,
  type TraceParams,
  type UsageDetails,
} from "./ports/observability.port.js";
export {
  type ExtractedProviderMetadata,
  type ProviderMetadataPort,
} from "./ports/provider-metadata.port.js";

// Result
export {
  classifyError,
  type GenerationError,
  type GenerationErrorCode,
  generationFailure,
  type GenerationResult,
  generationSuccess,
  isFailure,
  isSuccess,
  unwrap,
  unwrapOr,
} from "./result/result.js";

// Generation
export {
  generateStructured,
  type GenerateStructuredOptions,
} from "./generation/generate-structured.js";

// Parsing
export { createSchemaPrompt } from "./parsing/create-schema-prompt.js";
export { parseObject, ParseObjectError } from "./parsing/parse-object.js";
export { parseText, type ParseTextOptions } from "./parsing/parse-text.js";

// Provider - OpenRouter
export {
  createOpenRouterProvider,
  type ModelOptions,
  type OpenRouterConfig,
  type OpenRouterMetadata,
  type OpenRouterProvider,
} from "./provider/openrouter.provider.js";
export { OpenRouterMetadataAdapter } from "./provider/openrouter-metadata.adapter.js";

// Provider - OpenAI Compatible
export {
  createOpenAICompatibleProvider,
  type OpenAICompatibleConfig,
  type OpenAICompatibleModelOptions,
  type OpenAICompatibleProvider,
} from "./provider/openai-compatible.provider.js";
export { OpenAICompatibleMetadataAdapter } from "./provider/openai-compatible-metadata.adapter.js";
