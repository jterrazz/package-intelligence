import { DynamicStructuredTool, DynamicTool } from 'langchain/tools';
import type { z } from 'zod/v4';

import type { Tool } from '../../ports/tool.port.js';

export interface Logger {
    error(message: string, context?: Record<string, unknown>): void;
}

export interface SafeToolOptions<T> {
    logger?: Logger;
    schema?: z.ZodSchema<T>;
}

export type ToolConfig = {
    description: string;
    name: string;
};

export type ToolFunction<T = void> = T extends void
    ? () => Promise<string>
    : (args: T) => Promise<string>;

/**
 * Safe tool adapter that provides error handling and logging for LangChain tools
 */
export class SafeToolAdapter<T = void> implements Tool {
    private readonly dynamicTool: DynamicStructuredTool<z.ZodSchema<T>> | DynamicTool;

    constructor(
        private readonly config: ToolConfig,
        private readonly toolFunction: ToolFunction<T>,
        private readonly options: SafeToolOptions<T> = {},
    ) {
        const { logger, schema } = options;

        if (schema) {
            // Use DynamicStructuredTool for parameterized tools
            this.dynamicTool = new DynamicStructuredTool({
                description: config.description,
                func: async (args: T) => {
                    try {
                        return await (toolFunction as ToolFunction<T>)(args);
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
                        return await (toolFunction as ToolFunction<void>)();
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
