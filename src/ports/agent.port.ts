import type { Prompt } from './prompt.port.js';

/**
 * Port for chat agents
 */
export interface Agent {
    /**
     * Run the agent with optional user prompt and return optional response
     * @param userPrompt - The user prompt to process
     */
    run(userPrompt?: Prompt): Promise<null | string>;
}
