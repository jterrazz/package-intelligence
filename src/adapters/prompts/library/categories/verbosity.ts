/**
 * Controls the level of detail and length of the agent's responses.
 */
export const VERBOSITY = {
    CONCISE: `
<Verbosity>
You must provide brief, to-the-point answers. Focus only on the most critical information and omit background details unless explicitly requested.
</Verbosity>`,

    DETAILED: `
<Verbosity>
You must offer comprehensive and thorough responses. Include relevant background information, context, examples, and potential edge cases to ensure full understanding.
</Verbosity>`,

    NORMAL: `
<Verbosity>
You should provide a balanced level of detail, sufficient for a clear understanding without being overwhelming or too brief.
</Verbosity>`,
} as const;
