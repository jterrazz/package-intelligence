import { type LoggerPort } from '@jterrazz/logger';

import { type AgentPort } from '../../ports/agent.port.js';
import type { PromptPort } from '../../ports/prompt.port.js';

export interface RetryableAgentAdapterOptions {
    logger?: LoggerPort;
    retries?: number;
}

/**
 * A decorator agent that adds retry logic to an existing agent.
 * @template TInput - The TypeScript type of the input
 * @template TOutput - The TypeScript type of the output
 */
export class RetryableAgentAdapter<TInput = PromptPort, TOutput = string>
    implements AgentPort<TInput, TOutput>
{
    public readonly name: string;
    private readonly logger?: LoggerPort;
    private readonly retries: number;

    constructor(
        private readonly agent: AgentPort<TInput, TOutput>,
        options: RetryableAgentAdapterOptions = {},
    ) {
        const { logger, retries = 1 } = options;
        this.name = `Retryable(${agent.name})`;
        this.logger = logger;
        this.retries = retries;
    }

    async run(input?: TInput): Promise<null | TOutput> {
        const maxAttempts = this.retries + 1;

        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            try {
                this.logger?.debug(`[${this.name}] Attempt ${attempt} of ${maxAttempts}.`);
                const result = await this.agent.run(input);

                if (result !== null) {
                    this.logger?.info(
                        `[${this.name}] Attempt ${attempt} of ${maxAttempts} succeeded.`,
                    );
                    return result;
                }

                this.logger?.warn(
                    `[${this.name}] Attempt ${attempt} of ${maxAttempts} failed: agent returned null.`,
                );
            } catch (error) {
                this.logger?.warn(
                    `[${this.name}] Attempt ${attempt} of ${maxAttempts} failed with an error.`,
                    {
                        error: error instanceof Error ? error.message : 'Unknown error',
                    },
                );
            }
        }

        this.logger?.error(`[${this.name}] All ${maxAttempts} attempts failed.`);
        return null;
    }
}
