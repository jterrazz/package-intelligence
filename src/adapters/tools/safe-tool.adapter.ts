import type { LoggerPort } from '@jterrazz/logger';
import { DynamicStructuredTool, DynamicTool } from 'langchain/tools';
import type { z } from 'zod/v4';

import type { ToolPort } from '../../ports/tool.port.js';

export interface SafeToolOptions<T> {
    logger?: LoggerPort;
    schema?: z.ZodSchema<T>;
}

export type ToolConfig<T = void> = {
    description: string;
    execute: ToolFunction<T>;
    name: string;
};

export type ToolFunction<T = void> = T extends void
    ? () => Promise<string>
    : (args: T) => Promise<string>;

/**
 * Safe tool that provides error handling and logging for LangChain tools
 */
export class SafeTool<T = void> implements ToolPort {
    private readonly dynamicTool: DynamicStructuredTool<z.ZodSchema<T>> | DynamicTool;

    constructor(
        private readonly config: ToolConfig<T>,
        private readonly options: SafeToolOptions<T> = {},
    ) {
        const { logger, schema } = options;

        if (schema) {
            // Use DynamicStructuredTool for parameterized tools
            this.dynamicTool = new DynamicStructuredTool({
                description: config.description,
                func: async (args: T) => {
                    try {
                        return await (config.execute as ToolFunction<T>)(args);
                    } catch (error) {
                        const errorMessage = error instanceof Error ? error.message : String(error);

                        logger?.error(`Unexpected error in ${config.name}`, {
                            args,
                            error: errorMessage,
                            toolName: config.name,
                        });

                        return `Tool ${config.name} failed to execute`;
                    }
                },
                name: config.name,
                schema: schema,
            });
        } else {
            // Use DynamicTool for simple tools
            this.dynamicTool = new DynamicTool({
                description: config.description,
                func: async () => {
                    try {
                        return await (config.execute as ToolFunction<void>)();
                    } catch (error) {
                        const errorMessage = error instanceof Error ? error.message : String(error);

                        logger?.error(`Unexpected error in ${config.name}`, {
                            error: errorMessage,
                            toolName: config.name,
                        });

                        return `Tool ${config.name} failed to execute`;
                    }
                },
                name: config.name,
            });
        }
    }

    /**
     * Get the underlying LangChain DynamicTool instance
     */
    getDynamicTool(): DynamicStructuredTool<z.ZodSchema<unknown>> | DynamicTool {
        return this.dynamicTool as DynamicStructuredTool<z.ZodSchema<unknown>> | DynamicTool;
    }
}
