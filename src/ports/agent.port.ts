import type { PromptPort } from './prompt.port.js';

/**
 * Port for chat agents with generic input and output types
 * @template TInput - The type of input parameters the agent accepts
 * @template TOutput - The type of output the agent returns
 */
export interface AgentPort<TInput = PromptPort, TOutput = string> {
    /**
     * A descriptive name for the agent, used for logging and identification.
     */
    readonly name: string;

    /**
     * Run the agent with optional input and return optional response
     * @param input - The input to process
     */
    run(input?: TInput): Promise<null | TOutput>;
}
