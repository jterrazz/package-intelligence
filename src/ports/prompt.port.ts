/**
 * Port for prompt generation
 */
export interface Prompt {
    /**
     * Generate the prompt text
     */
    generate(): string;
}
