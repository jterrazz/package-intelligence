import type { Prompt } from '../../ports/prompt.port.js';

/**
 * User prompt adapter that generates a user prompt from a list of strings
 */
export class UserPromptAdapter implements Prompt {
    private readonly finalPrompt: string;

    constructor(...prompts: readonly (readonly string[] | string)[]) {
        const flattenedPrompts = prompts.flat();
        this.finalPrompt = flattenedPrompts.join('\n\n');
    }

    generate(): string {
        return this.finalPrompt;
    }
}
