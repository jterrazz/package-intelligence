import { type LoggerPort } from '@jterrazz/logger';
import {
    ChatPromptTemplate,
    HumanMessagePromptTemplate,
    SystemMessagePromptTemplate,
} from '@langchain/core/prompts';
import { AgentExecutor, createStructuredChatAgent } from 'langchain/agents';
import { z } from 'zod/v4';

import type { Agent } from '../../ports/agent.port.js';
import type { Model } from '../../ports/model.port.js';
import type { Prompt } from '../../ports/prompt.port.js';
import type { Tool } from '../../ports/tool.port.js';

import { AIResponseParser } from '../utils/ai-response-parser.js';

import type { SystemPromptAdapter } from '../prompts/system-prompt.adapter.js';

export type AgentResponse = z.infer<typeof AgentResponseSchema>;

export interface ChatAgentOptions {
    logger?: LoggerPort;
    model: Model;
    tools: Tool[];
}

// Schema for agent responses
const AgentResponseSchema = z.object({
    message: z.string().optional(),
    reason: z.string().optional(),
    shouldRespond: z.boolean(),
});

// LangChain-specific framework rules (internal to this adapter)
const LANGCHAIN_FRAMEWORK_RULES = `
<AGENT_FRAMEWORK>
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

"shouldRespond" set to true means the message will be sent to the user.
"shouldRespond" set to false means the message will not be sent to the user.

ALWAYS use this exact format with markdown code blocks and the action/action_input structure.
</AGENT_FRAMEWORK>`;

/**
 * Chat agent adapter that provides structured chat capabilities with optional responses
 */
export class ChatAgentAdapter implements Agent {
    private readonly executorPromise: Promise<AgentExecutor>;
    private readonly logger?: LoggerPort;
    private readonly name: string;
    private readonly responseParser: AIResponseParser<AgentResponse>;

    constructor(name: string, systemPrompt: SystemPromptAdapter, options: ChatAgentOptions) {
        this.name = name;
        this.logger = options.logger;
        this.responseParser = new AIResponseParser(AgentResponseSchema);
        this.executorPromise = this.createExecutor(systemPrompt, options);
    }

    async run(userPrompt?: Prompt): Promise<null | string> {
        try {
            const executor = await this.executorPromise;
            const input = this.resolveUserInput(userPrompt);
            const result = await executor.invoke({ input });

            this.logger?.debug('Agent execution result', {
                agentName: this.name,
                hasOutput: 'output' in result,
                hasUserPrompt: !!userPrompt,
                outputType: typeof result.output,
            });

            if (!result || typeof result.output === 'undefined') {
                throw new Error('Agent returned invalid result structure');
            }

            const response = this.parseAgentResponse(result.output);
            return this.handleResponse(response);
        } catch (error) {
            this.logger?.error('Error running chat agent', {
                agentName: this.name,
                error: error instanceof Error ? error.message : 'Unknown error',
                userPrompt: userPrompt ? 'Prompt object' : 'none',
            });
            return null;
        }
    }

    private async createExecutor(
        systemPrompt: SystemPromptAdapter,
        options: ChatAgentOptions,
    ): Promise<AgentExecutor> {
        const model = options.model.getModel();

        // Convert Tool instances to DynamicTool instances
        const dynamicTools = options.tools.map((tool) => tool.getDynamicTool());

        // Combine LangChain framework rules with user-provided system prompts
        const systemPromptText = `${LANGCHAIN_FRAMEWORK_RULES}\n\n${systemPrompt.generate()}`;
        const systemTemplate = SystemMessagePromptTemplate.fromTemplate(systemPromptText);
        const humanTemplate = HumanMessagePromptTemplate.fromTemplate('{input}');

        const prompt = ChatPromptTemplate.fromMessages([systemTemplate, humanTemplate]);

        const agent = await createStructuredChatAgent({
            llm: model,
            prompt,
            tools: dynamicTools,
        });

        return AgentExecutor.fromAgentAndTools({
            agent,
            tools: dynamicTools,
        });
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
            this.logger?.info('Agent responding with message', { agentName: this.name });
            return response.message;
        }

        if (!response.shouldRespond) {
            this.logger?.info('Agent chose not to respond', {
                agentName: this.name,
                reason: response.reason,
            });
            return null;
        }

        this.logger?.error('Invalid agent response state', { agentName: this.name, response });
        return null;
    }

    private parseAgentResponse(output: unknown): AgentResponse {
        try {
            // Handle LangChain's action/action_input format
            const processedOutput = this.extractActionInput(output);
            return this.responseParser.parse(processedOutput);
        } catch (error) {
            this.logger?.error('Failed to parse agent response', {
                agentName: this.name,
                error: error instanceof Error ? error.message : 'Unknown error',
                rawOutput: output,
            });
            throw new Error('Invalid agent response format');
        }
    }

    private resolveUserInput(userPrompt?: Prompt): string {
        if (!userPrompt) {
            return 'Please analyze the current situation and respond if appropriate.';
        }

        return userPrompt.generate();
    }
}
