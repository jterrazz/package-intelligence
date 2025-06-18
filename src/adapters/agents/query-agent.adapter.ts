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
 * Query agent adapter that provides simple one-shot prompt-response capabilities
 * No tools, no complex logic - just direct model interaction with optional schema parsing
 */
export class QueryAgentAdapter<T = string> implements AgentPort {
    protected readonly logger?: LoggerPort;
    protected readonly name: string;
    private lastParsedResult?: T;
    private readonly model: ModelPort;
    private readonly schema?: z.ZodSchema<T>;
    private readonly systemPrompt: SystemPromptAdapter;

    constructor(name: string, options: QueryAgentOptions<T>) {
        this.name = name;
        this.logger = options.logger;
        this.systemPrompt = options.systemPrompt;
        this.model = options.model;
        this.schema = options.schema;
    }

    /**
     * Get the last parsed result (only available if schema was provided and parsing succeeded)
     */
    getLastParsedResult(): T | undefined {
        return this.lastParsedResult;
    }

    async run(userPrompt?: PromptPort): Promise<null | string> {
        try {
            const model = this.model.getModel();
            const input = this.resolveUserInput(userPrompt);

            // Simple direct model call with system and user messages
            const messages = [
                { content: this.systemPrompt.generate(), role: 'system' as const },
                { content: input, role: 'user' as const },
            ];

            this.logger?.debug('Query agent executing', {
                agentName: this.name,
                hasSchema: !!this.schema,
                hasUserPrompt: !!userPrompt,
                systemPromptLength: this.systemPrompt.generate().length,
            });

            const result = await model.invoke(messages);
            const content = result.content;

            if (typeof content !== 'string') {
                throw new Error('Model returned non-string content');
            }

            // Parse with schema if available and store result
            if (this.schema) {
                this.lastParsedResult = this.parseResponse(content, this.schema);
            }

            this.logger?.info('Query agent completed successfully', {
                agentName: this.name,
                parsed: !!this.schema,
                responseLength: content.length,
            });

            return content;
        } catch (error) {
            this.logger?.error('Error running query agent', {
                agentName: this.name,
                error: error instanceof Error ? error.message : 'Unknown error',
                userPrompt: userPrompt ? 'Prompt object' : 'none',
            });
            return null;
        }
    }

    protected parseResponse<T>(content: string, schema: z.ZodSchema<T>): T {
        try {
            const parser = new AIResponseParser(schema);
            return parser.parse(content);
        } catch (error) {
            this.logger?.error('Failed to parse response', {
                agentName: this.name,
                error: error instanceof Error ? error.message : 'Unknown error',
                rawContent: content,
            });
            throw new Error('Invalid response format from model');
        }
    }

    protected resolveUserInput(userPrompt?: PromptPort): string {
        if (!userPrompt) {
            return 'Please provide a response based on your system instructions.';
        }

        return userPrompt.generate();
    }
}
