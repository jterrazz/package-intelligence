import { trace } from '@opentelemetry/api';
import type { LanguageModelMiddleware } from 'ai';

const AGENT_ATTRIBUTE = 'gen_ai.agent.name';

export type AgentMiddlewareOptions = {
    /** The agent this model serves, which becomes the generation's name in Langfuse */
    agentName: string;
};

/** Names the AI SDK's inference span after the agent, the only span Langfuse reads a generation from. */
export function createAgentMiddleware(options: AgentMiddlewareOptions): LanguageModelMiddleware {
    const { agentName } = options;

    const nameActiveSpan = (): void => {
        // outside: the AI SDK activates the inference span around the provider call, so it is the active one here.
        trace.getActiveSpan()?.updateName(agentName).setAttribute(AGENT_ATTRIBUTE, agentName);
    };

    return {
        // Stryker disable next-line StringLiteral: the AI SDK reads the version of a model, never of a middleware
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
