/**
 * Port for prompt generation
 */
export interface PromptPort {
    /**
     * Generate the prompt text
     */
    generate(): string;
}
