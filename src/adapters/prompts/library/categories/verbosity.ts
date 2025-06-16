/**
 * Controls the level of detail and length of the agent's responses.
 */
export const VERBOSITY = {
    CONCISE: `
<VERBOSITY>
Provide brief, to-the-point answers.
Focus only on the most critical information and omit background details unless requested.
</VERBOSITY>`,

    DETAILED: `
<VERBOSITY>
Offer comprehensive and thorough responses.
Include background information, context, examples, and potential edge cases.
</VERBOSITY>`,

    NORMAL: `
<VERBOSITY>
Provide a balanced level of detail, sufficient for a clear understanding without being overwhelming.
</VERBOSITY>`,
} as const;
