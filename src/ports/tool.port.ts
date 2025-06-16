import type { DynamicStructuredTool,DynamicTool } from 'langchain/tools';
import type { z } from 'zod/v4';

/**
 * Port for tools
 */
export interface Tool {
    /**
     * Get the underlying LangChain tool instance
     */
    getDynamicTool(): DynamicStructuredTool<z.ZodSchema<unknown>> | DynamicTool;
}
