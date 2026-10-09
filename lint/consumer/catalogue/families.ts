export const FAMILIES = {
    agents: 'The agent class and the prompt it pairs with',
    models: 'Where a model is resolved, and where its id is written',
    prompts: 'What a prompt file holds, and what it alone holds',
} as const;

export type Family = keyof typeof FAMILIES;
