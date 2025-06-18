import { type LoggerPort } from '@jterrazz/logger';
import { type z } from 'zod/v4';

import { type AgentPort } from '../../ports/agent.port.js';
import type { ModelPort } from '../../ports/model.port.js';
import type { PromptPort } from '../../ports/prompt.port.js';

import { AIResponseParser } from '../utils/ai-response-parser.js';

import type { SystemPromptAdapter } from '../prompts/system-prompt.adapter.js';

export interface QueryAgentOptions<T = string> {
    logger?: LoggerPort;
    model: ModelPort;
    schema?: z.ZodSchema<T>;
    systemPrompt: SystemPromptAdapter;
}

/**
 * A simple agent for direct, one-shot interactions with a model.
 * It supports optional response parsing against a Zod schema but does not use tools.
 */
export class QueryAgentAdapter<T = string> implements AgentPort {
    constructor(
        public readonly name: string,
        private readonly options: QueryAgentOptions<T>,
    ) {}

    async run(userPrompt?: PromptPort): Promise<null | string> {
        this.options.logger?.debug(`[${this.name}] Starting query execution.`);

        try {
            const content = await this.invokeModel(userPrompt);

            if (this.options.schema) {
                this.parseResponse(content, this.options.schema);
                this.options.logger?.info(`[${this.name}] Execution finished and response parsed.`);
            } else {
                this.options.logger?.info(`[${this.name}] Execution finished.`);
            }

            return content;
        } catch (error) {
            this.options.logger?.error(`[${this.name}] Execution failed.`, {
                error: error instanceof Error ? error.message : 'Unknown error',
            });
            return null;
        }
    }

    private async invokeModel(userPrompt?: PromptPort): Promise<string> {
        const userInput = this.resolveUserInput(userPrompt);
        const systemMessage = this.options.systemPrompt.generate();

        const messages = [
            { content: systemMessage, role: 'system' as const },
            { content: userInput, role: 'user' as const },
        ];

        this.options.logger?.debug(`[${this.name}] Invoking model...`, {
            hasSchema: !!this.options.schema,
        });

        const response = await this.options.model.getModel().invoke(messages);
        const { content } = response;

        if (typeof content !== 'string') {
            throw new Error('Model returned a non-string content type.');
        }

        return content;
    }

    private parseResponse<TResponse>(content: string, schema: z.ZodSchema<TResponse>): void {
        try {
            new AIResponseParser(schema).parse(content);
        } catch (error) {
            this.options.logger?.error(`[${this.name}] Failed to parse model response.`, {
                error: error instanceof Error ? error.message : 'Unknown error',
                rawContent: content,
            });
            throw new Error('Invalid response format from model.');
        }
    }

    private resolveUserInput(userPrompt?: PromptPort): string {
        if (userPrompt) {
            return userPrompt.generate();
        }
        return 'Proceed with your instructions.';
    }
}
