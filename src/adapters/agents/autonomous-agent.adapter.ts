import { type LoggerPort } from '@jterrazz/logger';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { AgentExecutor, createStructuredChatAgent } from 'langchain/agents';
import { z } from 'zod/v4';

import { type AgentPort } from '../../ports/agent.port.js';
import type { ModelPort } from '../../ports/model.port.js';
import type { PromptPort } from '../../ports/prompt.port.js';
import type { ToolPort } from '../../ports/tool.port.js';

import { AIResponseParser } from '../utils/ai-response-parser.js';

import type { SystemPromptAdapter } from '../prompts/system-prompt.adapter.js';

export interface AutonomousAgentOptions<TOutput = string> {
    logger?: LoggerPort;
    model: ModelPort;
    schema?: z.ZodSchema<TOutput>;
    systemPrompt: SystemPromptAdapter;
    tools: ToolPort[];
    verbose?: boolean;
}

const SYSTEM_PROMPT_TEMPLATE = `
<OBJECTIVE>
{mission_prompt}
</OBJECTIVE>

<GLOBAL_WRAPPER_OUTPUT_FORMAT>
CRITICAL: The format instructions in this section are the ONLY valid way to structure your response. Your entire response MUST be a single JSON markdown code block. Any formatting guidelines within the <OBJECTIVE> section apply ONLY to the content inside the "RESPOND:" part of your final "action_input".

REQUIRED: You have two ways to respond:

1.  **Call a tool** to gather information. For this, you MUST output a JSON blob with the tool's name and its input.
    *Valid tool names are: {tool_names}*
    \`\`\`json
    {{
      "action": "tool_name_to_use",
      "action_input": "the input for the tool, or an empty object {{}} if no input is needed"
    }}
    \`\`\`

2.  **Provide the Final Answer** once you have enough information. For this, you MUST output a JSON blob with the "Final Answer" action.
    The "action_input" for a "Final Answer" MUST be a string that begins with either "RESPOND: " for a message or "SILENT: " for no message. This prefix is a literal part of the output string and MUST NOT be omitted.
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

    YOU MUST ALWAYS INCLUDE "RESPOND:" OR "SILENT:" IN YOUR FINAL ANSWER'S "action_input". FAILURE TO DO SO WILL CAUSE AN ERROR.

{schema_format}
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
 * An autonomous agent that uses tools and a structured prompt to accomplish tasks.
 * It can decide whether to respond or remain silent and supports schema-validated responses.
 * @template TOutput - The TypeScript type of the output
 */
export class AutonomousAgentAdapter<TOutput = string> implements AgentPort<PromptPort, TOutput> {
    constructor(
        public readonly name: string,
        private readonly options: AutonomousAgentOptions<TOutput>,
    ) {}

    async run(input?: PromptPort): Promise<null | TOutput> {
        this.options.logger?.debug(`[${this.name}] Starting chat execution.`);

        try {
            const executor = await this.createExecutor();
            const userInput = this.resolveUserInput(input);

            const result = await executor.invoke({ input: userInput });

            this.options.logger?.debug(`[${this.name}] Agent execution completed.`, {
                hasOutput: 'output' in result,
            });

            if (!result || typeof result.output !== 'string') {
                throw new Error('Agent returned an invalid result structure.');
            }

            const agentResponse = this.parseAgentOutput(result.output);

            if (!agentResponse) {
                return null;
            }

            if (!agentResponse.shouldRespond) {
                this.options.logger?.info(`[${this.name}] Agent chose to remain silent.`, {
                    reason: agentResponse.reason,
                });
                return null;
            }

            const message = agentResponse.message ?? '';

            if (this.options.schema) {
                const validatedResponse = this.validateResponseContent(
                    message,
                    this.options.schema,
                );

                this.options.logger?.info(
                    `[${this.name}] Execution finished; response content validated.`,
                );
                return validatedResponse;
            } else {
                this.options.logger?.info(`[${this.name}] Execution finished.`);
                // When no schema is provided, we assume TOutput is string (default), so message is the result
                return message as TOutput;
            }
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

        // Add schema format instructions if schema is provided
        let schemaFormatInstructions = '';
        if (this.options.schema) {
            const jsonSchema = z.toJSONSchema(this.options.schema);
            const isPrimitiveType = ['boolean', 'integer', 'number', 'string'].includes(
                jsonSchema.type as string,
            );
            const jsonSchemaString = JSON.stringify(jsonSchema, null, 2)
                .replace(/{/g, '{{')
                .replace(/}/g, '}}');

            if (isPrimitiveType) {
                schemaFormatInstructions = `

SCHEMA VALIDATION: When providing a "RESPOND:" answer, the content after "RESPOND: " must be a ${jsonSchema.type} value that matches this schema:

\`\`\`json
${jsonSchemaString}
\`\`\`

Example format:
\`\`\`json
{{
  "action": "Final Answer",
  "action_input": "RESPOND: your ${jsonSchema.type} value here"
}}
\`\`\`

Do not wrap the ${jsonSchema.type} value in JSON - just provide the raw value after "RESPOND: ".`;
            } else {
                schemaFormatInstructions = `

SCHEMA VALIDATION: When providing a "RESPOND:" answer, the content after "RESPOND: " must be valid JSON that matches this exact schema:

\`\`\`json
${jsonSchemaString}
\`\`\`

Example format:
\`\`\`json
{{
  "action": "Final Answer",
  "action_input": "RESPOND: {{\\"field1\\": \\"value1\\", \\"field2\\": \\"value2\\"}}"
}}
\`\`\`
`;
            }
        }

        const prompt = ChatPromptTemplate.fromMessages([
            [
                'system',
                SYSTEM_PROMPT_TEMPLATE.replace(
                    '{mission_prompt}',
                    this.options.systemPrompt.generate(),
                ).replace('{schema_format}', schemaFormatInstructions),
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

    private parseAgentOutput(output: string): null | {
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

        this.options.logger?.error(
            `[${this.name}] Agent output was missing 'RESPOND:' or 'SILENT:' prefix.`,
            { rawOutput: output },
        );

        return null;
    }

    private resolveUserInput(input?: PromptPort): string {
        if (input) {
            return input.generate();
        }
        return 'Proceed with your instructions.';
    }

    private validateResponseContent<TResponse>(
        content: string,
        schema: z.ZodSchema<TResponse>,
    ): TResponse {
        try {
            return new AIResponseParser(schema).parse(content);
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
