/**
 * Port for chat agents
 */
export interface Agent {
    /**
     * Run the agent with optional user input and return optional response
     */
    run(userQuery?: string): Promise<null | string>;
}
