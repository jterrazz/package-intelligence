import type { Prompt } from '../../ports/prompt.port.js';

/**
 * System prompt adapter that generates a system prompt from a list of strings
 */
export class SystemPromptAdapter implements Prompt {
    private readonly finalPrompt: string;

    constructor(prompts: readonly string[]) {
        this.finalPrompt = prompts.join('\n\n');
    }

    generate(): string {
        return this.finalPrompt;
    }
}
