import { ChatPromptTemplate } from '@langchain/core/prompts';
import { AgentExecutor, createStructuredChatAgent } from 'langchain/agents';
import type { DynamicTool } from 'langchain/tools';
import { z } from 'zod/v4';

import type { Agent } from '../../ports/agent.port.js';
import type { Model } from '../../ports/model.port.js';

import { AIResponseParser } from '../utils/ai-response-parser.js';

export type AgentResponse = z.infer<typeof AgentResponseSchema>;

export interface ChatAgentConfig {
    logger?: Logger;
    model: Model;
    prompts?: string[];
    tools: DynamicTool[];
}

export interface Logger {
    debug(message: string, context?: Record<string, unknown>): void;
    error(message: string, context?: Record<string, unknown>): void;
    info(message: string, context?: Record<string, unknown>): void;
}

// Schema for agent responses
const AgentResponseSchema = z.object({
    message: z.string().optional(),
    reason: z.string().optional(),
    shouldRespond: z.boolean(),
});

const AGENT_RULES = `
<AGENT_RULES>
You are a chat agent piloted by the LangChain framework.

You have access to the following tools: {tools}
Tool names: {tool_names}
Agent scratchpad: {agent_scratchpad}

When you want to provide your final response, you MUST format it exactly like this:

\`\`\`json
{{"action": "Final Answer", "action_input": {{"shouldRespond": false, "reason": "<your reason>"}}}}
\`\`\`

OR 

\`\`\`json
{{"action": "Final Answer", "action_input": {{"shouldRespond": true, "message": "<your response message>"}}}}
\`\`\`

ALWAYS use this exact format with markdown code blocks and the action/action_input structure.
USE tools to get accurate, up-to-date information
ONLY respond when you have something valuable to contribute
</AGENT_RULES>
`;

/**
 * Chat agent adapter that provides structured chat capabilities with optional responses
 */
export class ChatAgentAdapter implements Agent {
    private executor: AgentExecutor | null = null;
    private readonly logger?: Logger;
    private readonly model: Model;
    private readonly responseParser: AIResponseParser<AgentResponse>;
    private readonly systemPrompt: string;
    private readonly tools: DynamicTool[];

    constructor(config: ChatAgentConfig) {
        this.model = config.model;
        this.tools = config.tools;
        this.logger = config.logger;
        this.systemPrompt = this.buildSystemPrompt(config.prompts || []);
        this.responseParser = new AIResponseParser(AgentResponseSchema);
    }

    async run(userQuery?: string): Promise<null | string> {
        try {
            if (!this.executor) {
                await this.initializeExecutor();
            }

            // Use default input when no user query is provided
            const input =
                userQuery || 'Please analyze the current situation and respond if appropriate.';
            const result = await this.executor!.invoke({ input });

            this.logger?.debug('Agent execution result', {
                hasOutput: 'output' in result,
                hasUserQuery: !!userQuery,
                outputType: typeof result.output,
            });

            if (!result || typeof result.output === 'undefined') {
                throw new Error('Agent returned invalid result structure');
            }

            const response = this.parseAgentResponse(result.output);
            return this.handleResponse(response);
        } catch (error) {
            this.logger?.error('Error running chat agent', {
                error: error instanceof Error ? error.message : 'Unknown error',
                userQuery: userQuery || 'none',
            });
            return null;
        }
    }

    private buildSystemPrompt(customPrompts: string[]): string {
        return [AGENT_RULES, ...customPrompts].join('\n');
    }

    private extractActionInput(output: unknown): string {
        if (typeof output === 'object' && output !== null) {
            return JSON.stringify(output);
        }

        if (typeof output !== 'string') {
            return String(output);
        }

        // Check for LangChain's action/action_input format first
        const codeBlockMatch = output.match(/```(?:json)?\s*([\s\S]*?)```/i);
        if (codeBlockMatch) {
            const content = codeBlockMatch[1].trim();
            try {
                const parsed = JSON.parse(content);
                if (parsed.action === 'Final Answer' && parsed.action_input) {
                    return JSON.stringify(parsed.action_input);
                }
            } catch {
                // Fall through to return original content
            }
            return content;
        }

        // Fallback: Look for "Final Answer:" pattern
        if (output.includes('Final Answer:')) {
            const actionInputMatch = output.match(/Final Answer:\s*([\s\S]*?)$/i);
            if (actionInputMatch) {
                return actionInputMatch[1].trim();
            }
        }

        return output;
    }

    private handleResponse(response: AgentResponse): null | string {
        if (response.shouldRespond && response.message) {
            this.logger?.info('Agent responding with message');
            return response.message;
        }

        if (!response.shouldRespond) {
            this.logger?.info('Agent chose not to respond', {
                reason: response.reason,
            });
            return null;
        }

        this.logger?.error('Invalid agent response state', { response });
        return null;
    }

    private async initializeExecutor(): Promise<void> {
        const model = this.model.getModel();
        const prompt = ChatPromptTemplate.fromMessages([['human', `${this.systemPrompt} {input}`]]);

        const agent = await createStructuredChatAgent({
            llm: model,
            prompt,
            tools: this.tools,
        });

        this.executor = AgentExecutor.fromAgentAndTools({
            agent,
            tools: this.tools,
        });
    }

    private parseAgentResponse(output: unknown): AgentResponse {
        try {
            const processedOutput = this.extractActionInput(output);
            return this.responseParser.parse(processedOutput);
        } catch (error) {
            this.logger?.error('Failed to parse agent response', {
                error: error instanceof Error ? error.message : 'Unknown error',
                rawOutput: output,
            });
            throw new Error('Invalid agent response format');
        }
    }
}
