// =============================================================================
// AGENTS
// =============================================================================

export { ChatAgent, type ChatAgentOptions } from './adapters/agents/chat-agent.adapter.js';

export {
    ResilientAgent,
    type ResilientAgentOptions,
} from './adapters/agents/resilient-agent.adapter.js';

export { ToolAgent, type ToolAgentOptions } from './adapters/agents/tool-agent.adapter.js';

// =============================================================================
// MODEL PROVIDERS
// =============================================================================

export { OpenRouterModel } from './adapters/models/openrouter-model.adapter.js';

export { PROMPT_LIBRARY as PROMPTS } from './adapters/prompts/library/index.js';

// =============================================================================
// PROMPTS
// =============================================================================

export { SystemPrompt } from './adapters/prompts/system-prompt.adapter.js';
export { UserPrompt } from './adapters/prompts/user-prompt.adapter.js';
export {
    type OpenRouterConfig,
    type OpenRouterMetadata,
    OpenRouterProvider,
} from './adapters/providers/openrouter-provider.adapter.js';

// =============================================================================
// TOOLS
// =============================================================================

export { SafeTool } from './adapters/tools/safe-tool.adapter.js';

// =============================================================================
// UTILITIES
// =============================================================================

export { StructuredResponseParser } from './adapters/utils/structured-response-parser.js';

// =============================================================================
// PORTS (Interfaces)
// =============================================================================

export * from './ports/agent.port.js';
export * from './ports/model.port.js';
export * from './ports/prompt.port.js';
export * from './ports/provider.port.js';
export * from './ports/tool.port.js';
