import { type LoggerPort } from '@jterrazz/logger';

import { type AgentPort } from '../../ports/agent.port.js';
import type { PromptPort } from '../../ports/prompt.port.js';

export interface ResilientAgentOptions {
    logger?: LoggerPort;
    retries?: number;
}

/**
 * A decorator agent that adds retry logic to an existing agent for resilient execution.
 * @template TInput - The TypeScript type of the input
 * @template TOutput - The TypeScript type of the output
 */
export class ResilientAgent<TInput = PromptPort, TOutput = string>
    implements AgentPort<TInput, TOutput>
{
    public readonly name: string;
    private readonly logger?: LoggerPort;
    private readonly retries: number;

    constructor(
        private readonly agent: AgentPort<TInput, TOutput>,
        options: ResilientAgentOptions = {},
    ) {
        const { logger, retries = 1 } = options;
        this.name = `Resilient(${agent.name})`;
        this.logger = logger;
        this.retries = retries;
    }

    async run(input?: TInput): Promise<null | TOutput> {
        const maxAttempts = this.retries + 1;

        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            try {
                this.logger?.debug(`Attempt ${attempt} of ${maxAttempts}`, { agent: this.name });
                const result = await this.agent.run(input);

                if (result !== null) {
                    this.logger?.debug(`Attempt ${attempt} of ${maxAttempts} succeeded`, {
                        agent: this.name,
                    });
                    return result;
                }

                this.logger?.debug(
                    `Attempt ${attempt} of ${maxAttempts} failed: agent returned null`,
                    { agent: this.name },
                );
            } catch (error) {
                this.logger?.debug(`Attempt ${attempt} of ${maxAttempts} failed with an error`, {
                    agent: this.name,
                    error: error instanceof Error ? error.message : 'Unknown error',
                });
            }
        }

        this.logger?.error(`All ${maxAttempts} attempts failed`, { agent: this.name });
        return null;
    }
}
