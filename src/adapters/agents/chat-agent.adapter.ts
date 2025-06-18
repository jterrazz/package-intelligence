import { type LoggerPort } from '@jterrazz/logger';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { AgentExecutor, createStructuredChatAgent } from 'langchain/agents';
import { type z } from 'zod/v4';

import { type AgentPort } from '../../ports/agent.port.js';
import type { ModelPort } from '../../ports/model.port.js';
import type { PromptPort } from '../../ports/prompt.port.js';
import type { ToolPort } from '../../ports/tool.port.js';

import { AIResponseParser } from '../utils/ai-response-parser.js';

import type { SystemPromptAdapter } from '../prompts/system-prompt.adapter.js';

export interface ChatAgentOptions<T = unknown> {
    logger?: LoggerPort;
    model: ModelPort;
    schema?: z.ZodSchema<T>;
    systemPrompt: SystemPromptAdapter;
    tools: ToolPort[];
}

// Internal response type for LangChain agent responses
type InternalChatResponse = {
    message?: string;
    reason?: string;
    shouldRespond: boolean;
};

const SYSTEM_PROMPT_TEMPLATE = `
<OBJECTIVE>
{mission_prompt}
</OBJECTIVE>

<OUTPUT_FORMAT>
CRITICAL: The format instructions in this section are the ONLY valid way to structure your response. Any formatting guidelines within the <OBJECTIVE> section (like message templates) apply ONLY to the content that goes inside the "RESPOND: " part of your final answer.

You have two ways to respond:

1.  **Call a tool** to gather information. For this, you MUST output a JSON blob with the tool's name and its input.
    *Valid tool names are: {tool_names}*
    \`\`\`json
    {{
      "action": "tool_name_to_use",
      "action_input": "the input for the tool, or an empty object {{}} if no input is needed"
    }}
    \`\`\`

2.  **Provide the Final Answer** once you have enough information. For this, you MUST output a JSON blob with the "Final Answer" action. The input must start with "RESPOND: " or "SILENT: ".
    - To send a message:
      \`\`\`json
      {{
        "action": "Final Answer",
        "action_input": "RESPOND: <your response message>"
      }}
      \`\`\`
    - To stay silent:
      \`\`\`json
      {{
        "action": "Final Answer",
        "action_input": "SILENT: <your reason for staying silent>"
      }}
      \`\`\`
</OUTPUT_FORMAT>

<EXECUTION_CONTEXT>
This is internal data for your reference.

<TOOLS>
{tools}
</TOOLS>

<WORKING_MEMORY>
This is your internal thought process and previous tool usage.
{agent_scratchpad}
</WORKING_MEMORY>
</EXECUTION_CONTEXT>
`;

/**
 * Chat agent adapter that provides structured chat capabilities with optional responses
 */
export class ChatAgentAdapter<T = unknown> implements AgentPort {
    protected readonly logger?: LoggerPort;
    protected readonly name: string;
    private lastParsedResult?: T;
    private readonly model: ModelPort;
    private readonly schema?: z.ZodSchema<T>;
    private readonly systemPrompt: SystemPromptAdapter;
    private readonly tools: ToolPort[];

    constructor(name: string, options: ChatAgentOptions<T>) {
        this.name = name;
        this.logger = options.logger;
        this.model = options.model;
        this.schema = options.schema;
        this.systemPrompt = options.systemPrompt;
        this.tools = options.tools;
    }

    /**
     * Get the last successfully parsed user data result (if schema was provided)
     */
    getLastParsedResult(): T | undefined {
        return this.lastParsedResult;
    }

    async run(userPrompt?: PromptPort): Promise<null | string> {
        try {
            const executor = await this.createExecutor();
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

    private async createExecutor(): Promise<AgentExecutor> {
        const model = this.model.getModel();

        // Convert Tool instances to DynamicTool instances
        const dynamicTools = this.tools.map((tool) => tool.getDynamicTool());

        // Use LangChain's clean tuple-based message format
        const prompt = ChatPromptTemplate.fromMessages([
            [
                'system',
                SYSTEM_PROMPT_TEMPLATE.replace('{mission_prompt}', this.systemPrompt.generate()),
            ],
            ['human', '{input}'],
        ]);

        const agent = await createStructuredChatAgent({
            llm: model,
            prompt,
            tools: dynamicTools,
        });

        return AgentExecutor.fromAgentAndTools({
            agent,
            tools: dynamicTools,
            verbose: true,
        });
    }

    private handleResponse(response: InternalChatResponse): null | string {
        if (response.shouldRespond && response.message) {
            this.logger?.info('Agent responding with message', { agentName: this.name });

            // If schema is provided, parse the message as JSON and store result
            if (this.schema) {
                try {
                    this.lastParsedResult = this.parseResponse(response.message, this.schema);
                    this.logger?.debug('Successfully parsed JSON response', {
                        agentName: this.name,
                    });
                } catch (error) {
                    this.logger?.warn('Failed to parse message as JSON with provided schema', {
                        agentName: this.name,
                        error: error instanceof Error ? error.message : 'Unknown error',
                        message: response.message,
                    });
                    // Continue with returning the raw message even if JSON parsing fails
                }
            }

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

    private parseAgentResponse(output: unknown): InternalChatResponse {
        try {
            // Parse the simple text format
            return this.parseTextResponse(output);
        } catch (error) {
            this.logger?.error('Failed to parse agent response', {
                agentName: this.name,
                error: error instanceof Error ? error.message : 'Unknown error',
                rawOutput: output,
            });
            throw new Error('Invalid agent response format');
        }
    }

    private parseTextResponse(output: unknown): InternalChatResponse {
        const text = typeof output === 'string' ? output.trim() : String(output).trim();

        // Check for "RESPOND:" pattern
        const respondMatch = text.match(/^RESPOND:\s*([\s\S]+)$/i);
        if (respondMatch) {
            return {
                message: respondMatch[1].trim(),
                shouldRespond: true,
            };
        }

        // Check for "SILENT:" pattern
        const silentMatch = text.match(/^SILENT:\s*([\s\S]+)$/i);
        if (silentMatch) {
            return {
                reason: silentMatch[1].trim(),
                shouldRespond: false,
            };
        }

        // Fallback: treat as a regular message
        return {
            message: text,
            shouldRespond: true,
        };
    }
}
