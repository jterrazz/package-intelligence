import type { PromptPort } from '../../ports/prompt.port.js';

/**
 * System prompt adapter that generates a system prompt from a list of strings
 */
export class SystemPromptAdapter implements PromptPort {
    private readonly finalPrompt: string;

    constructor(...prompts: readonly (readonly string[] | string)[]) {
        const flattenedPrompts = prompts.flat();
        this.finalPrompt = flattenedPrompts.join('\n\n');
    }

    generate(): string {
        return this.finalPrompt;
    }
}
