import { trace } from '@opentelemetry/api';
import type { LanguageModelMiddleware } from 'ai';

const AGENT_ATTRIBUTE = 'gen_ai.agent.name';

export type AgentMiddlewareOptions = {
    /** The agent this model serves — becomes the generation's name in Langfuse */
    agentName: string;
};

/** Names the AI SDK's inference span after the agent, the only span Langfuse reads a generation from. */
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
            return await doGenerate();
        },
        wrapStream: async ({ doStream }) => {
            nameActiveSpan();
            return await doStream();
        },
    };
}
