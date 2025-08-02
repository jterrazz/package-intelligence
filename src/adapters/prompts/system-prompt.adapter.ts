import type { PromptPort } from '../../ports/prompt.port.js';

/**
 * System prompt that generates a system prompt from a list of strings
 */
export class SystemPrompt implements PromptPort {
    private readonly finalPrompt: string;

    constructor(...prompts: readonly (readonly string[] | string)[]) {
        const flattenedPrompts = prompts.flat();
        this.finalPrompt = flattenedPrompts.join('\n\n');
    }

    generate(): string {
        return this.finalPrompt;
    }
}
