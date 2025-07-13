import { type LoggerPort } from '@jterrazz/logger';
import { z } from 'zod/v4';

import { type AgentPort } from '../../ports/agent.port.js';
import type { ModelPort } from '../../ports/model.port.js';
import type { PromptPort } from '../../ports/prompt.port.js';

import { AIResponseParser } from '../utils/ai-response-parser.js';

import type { SystemPromptAdapter } from '../prompts/system-prompt.adapter.js';

export interface BasicAgentOptions<TOutput = string> {
    logger?: LoggerPort;
    model: ModelPort;
    schema?: z.ZodSchema<TOutput>;
    systemPrompt: SystemPromptAdapter;
    verbose?: boolean;
}

/**
 * A basic agent for direct, one-shot interactions with a model.
 * It supports optional response parsing against a Zod schema but does not use tools.
 * @template TOutput - The TypeScript type of the output
 */
export class BasicAgentAdapter<TOutput = string> implements AgentPort<PromptPort, TOutput> {
    constructor(
        public readonly name: string,
        private readonly options: BasicAgentOptions<TOutput>,
    ) {}

    async run(input?: PromptPort): Promise<null | TOutput> {
        this.options.logger?.debug('Starting query execution', { agent: this.name });

        try {
            const content = await this.invokeModel(input);

            if (this.options.schema) {
                const parsedResponse = this.parseResponse(content, this.options.schema);
                this.options.logger?.debug('Execution finished and response parsed', { agent: this.name });
                return parsedResponse;
            } else {
                this.options.logger?.debug('Execution finished', { agent: this.name });
                // When no schema is provided, we assume TOutput is string (default), so content is the result
                return content as TOutput;
            }
        } catch (error) {
            this.options.logger?.error('Execution failed', {
                agent: this.name,
                error: error instanceof Error ? error.message : 'Unknown error',
            });
            return null;
        }
    }

    private async invokeModel(input?: PromptPort): Promise<string> {
        const userInput = this.resolveUserInput(input);
        let systemMessage = this.options.systemPrompt.generate();

        // Add schema definition to system prompt if schema is provided
        if (this.options.schema) {
            const jsonSchema = z.toJSONSchema(this.options.schema);
            const isPrimitiveType = ['boolean', 'integer', 'number', 'string'].includes(
                jsonSchema.type as string,
            );

            if (isPrimitiveType) {
                systemMessage += `\n\n<OUTPUT_FORMAT>
You must respond with a ${jsonSchema.type} value that matches this schema:

\`\`\`json
${JSON.stringify(jsonSchema, null, 2)}
\`\`\`

Your response should be only the ${jsonSchema.type} value, without any JSON wrapping or additional text.
</OUTPUT_FORMAT>`;
            } else {
                systemMessage += `\n\n<OUTPUT_FORMAT>
You must respond with valid JSON that matches this JSON schema description:

\`\`\`json
${JSON.stringify(jsonSchema, null, 2)}
\`\`\`

Your response must be parseable JSON that validates against this schema. Do not include any text outside the JSON.
</OUTPUT_FORMAT>`;
            }
        }

        const messages = [
            { content: systemMessage, role: 'system' as const },
            { content: userInput, role: 'user' as const },
        ];

        this.options.logger?.debug('Invoking model...', {
            agent: this.name,
            hasSchema: !!this.options.schema,
        });

        if (this.options.verbose) {
            this.options.logger?.debug('Sending messages to model...', {
                agent: this.name,
                messages,
            });
        }

        const response = await this.options.model.getModel().invoke(messages);
        const { content } = response;

        if (typeof content !== 'string') {
            throw new Error('Model returned a non-string content type.');
        }

        return content;
    }

    private parseResponse<TResponse>(content: string, schema: z.ZodSchema<TResponse>): TResponse {
        try {
            return new AIResponseParser(schema).parse(content);
        } catch (error) {
            this.options.logger?.error('Failed to parse model response.', {
                agent: this.name,
                error: error instanceof Error ? error.message : 'Unknown error',
                rawContent: content,
            });
            throw new Error('Invalid response format from model.');
        }
    }

    private resolveUserInput(input?: PromptPort): string {
        if (input) {
            return input.generate();
        }
        return 'Proceed with your instructions.';
    }
}
