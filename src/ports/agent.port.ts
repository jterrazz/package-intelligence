import type { PromptPort } from './prompt.port.js';

/**
 * Port for chat agents
 */
export interface AgentPort {
    /**
     * Run the agent with optional user prompt and return optional response
     * @param userPrompt - The user prompt to process
     */
    run(userPrompt?: PromptPort): Promise<null | string>;
}
