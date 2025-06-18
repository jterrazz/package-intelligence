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
    verbose?: boolean;
}

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
 * An advanced agent that uses tools and a structured prompt to engage in conversational chat.
 * It can decide whether to respond or remain silent and supports schema-validated responses.
 */
export class ChatAgentAdapter<T = unknown> implements AgentPort {
    constructor(
        public readonly name: string,
        private readonly options: ChatAgentOptions<T>,
    ) {}

    async run(userPrompt?: PromptPort): Promise<null | string> {
        this.options.logger?.debug(`[${this.name}] Starting chat execution.`);

        try {
            const executor = await this.createExecutor();
            const userInput = this.resolveUserInput(userPrompt);

            const result = await executor.invoke({ input: userInput });

            this.options.logger?.debug(`[${this.name}] Agent execution completed.`, {
                hasOutput: 'output' in result,
            });

            if (!result || typeof result.output !== 'string') {
                throw new Error('Agent returned an invalid result structure.');
            }

            const agentResponse = this.parseAgentOutput(result.output);

            if (!agentResponse.shouldRespond) {
                this.options.logger?.info(`[${this.name}] Agent chose to remain silent.`, {
                    reason: agentResponse.reason,
                });
                return null;
            }

            const message = agentResponse.message ?? '';

            if (this.options.schema) {
                this.validateResponseContent(message, this.options.schema);
                this.options.logger?.info(
                    `[${this.name}] Execution finished; response content validated.`,
                );
            } else {
                this.options.logger?.info(`[${this.name}] Execution finished.`);
            }

            return message;
        } catch (error) {
            this.options.logger?.error(`[${this.name}] Chat execution failed.`, {
                error: error instanceof Error ? error.message : 'Unknown error',
            });
            return null;
        }
    }

    private async createExecutor(): Promise<AgentExecutor> {
        const model = this.options.model.getModel();
        const tools = this.options.tools.map((tool) => tool.getDynamicTool());

        const prompt = ChatPromptTemplate.fromMessages([
            [
                'system',
                SYSTEM_PROMPT_TEMPLATE.replace(
                    '{mission_prompt}',
                    this.options.systemPrompt.generate(),
                ),
            ],
            ['human', '{input}'],
        ]);

        const agent = await createStructuredChatAgent({
            llm: model,
            prompt,
            tools,
        });

        return AgentExecutor.fromAgentAndTools({
            agent,
            tools,
            verbose: this.options.verbose,
        });
    }

    private parseAgentOutput(output: string): {
        message?: string;
        reason?: string;
        shouldRespond: boolean;
    } {
        const text = output.trim();

        const respondMatch = text.match(/^RESPOND:\s*([\s\S]+)$/i);
        if (respondMatch) {
            return { message: respondMatch[1].trim(), shouldRespond: true };
        }

        const silentMatch = text.match(/^SILENT:\s*([\s\S]+)$/i);
        if (silentMatch) {
            return { reason: silentMatch[1].trim(), shouldRespond: false };
        }

        this.options.logger?.warn(
            `[${this.name}] Agent output was missing 'RESPOND:' or 'SILENT:' prefix. Treating as a direct response.`,
            { rawOutput: output },
        );

        return { message: text, shouldRespond: true };
    }

    private resolveUserInput(userPrompt?: PromptPort): string {
        if (userPrompt) {
            return userPrompt.generate();
        }
        return 'Proceed with your instructions.';
    }

    private validateResponseContent<TResponse>(
        content: string,
        schema: z.ZodSchema<TResponse>,
    ): void {
        try {
            new AIResponseParser(schema).parse(content);
        } catch (error) {
            this.options.logger?.error(
                `[${this.name}] Failed to validate response content against schema.`,
                {
                    error: error instanceof Error ? error.message : 'Unknown error',
                    rawContent: content,
                },
            );
            throw new Error('Invalid response content from model.');
        }
    }
}
