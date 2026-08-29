import { trace } from '@opentelemetry/api';
import type { LanguageModelMiddleware } from 'ai';

const AGENT_ATTRIBUTE = 'gen_ai.agent.name';

export interface AgentMiddlewareOptions {
    /** The agent this model serves — becomes the generation's name in Langfuse */
    agentName: string;
}

/**
 * Creates middleware that names the AI SDK's inference span after the agent.
 *
 * The AI SDK names that span `chat <model>` and only puts the agent identity
 * (`gen_ai.agent.name`, from `experimental_telemetry.functionId`) on the
 * parent `invoke_agent` span. Langfuse extracts model, usage and cost from
 * the inference span alone, so a pipeline that forwards only that span would
 * otherwise show every agent as "chat <model>". This runs inside the
 * inference span's context (the AI SDK activates it for the provider call),
 * so the active span is the right one.
 *
 * Never throws: all enrichment is best-effort.
 */
export function createAgentMiddleware(options: AgentMiddlewareOptions): LanguageModelMiddleware {
    const { agentName } = options;

    const nameActiveSpan = (): void => {
        try {
            const span = trace.getActiveSpan();
            if (!span) {
                return;
            }
            span.updateName(agentName);
            span.setAttribute(AGENT_ATTRIBUTE, agentName);
        } catch {
            // Best-effort: telemetry enrichment must never break generation.
        }
    };

    return {
        specificationVersion: 'v4',
        wrapGenerate: async ({ doGenerate }) => {
            nameActiveSpan();
            return doGenerate();
        },
        wrapStream: async ({ doStream }) => {
            nameActiveSpan();
            return doStream();
        },
    };
}
