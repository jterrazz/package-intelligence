export const MAX_LENGTH = 500;

export const buildPrompt = (v: string): string => `Hello ${v}`;

export const buildCount = (): number => 42;

export function buildFooter(): string {
    return 'Thanks.';
}

export class PromptBuilder {}

export default buildPrompt;
