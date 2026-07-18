interface Variables {
    topic: string;
}

export const buildPrompt = (v: Variables): string => `Summarize ${v.topic}.`;
