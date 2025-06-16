/**
 * Defines the structural format of the agent's output.
 */
export const FORMAT = {
    JSON: `
<FORMAT>
Respond ONLY with a valid, well-formed JSON object.
Do not include any explanatory text or markdown formatting outside of the JSON structure.
</FORMAT>`,

    MARKDOWN: `
<FORMAT>
Use Markdown for clear, structured responses.
Employ headings, lists, bold/italic text, and code blocks to improve readability.
</FORMAT>`,

    PLAIN_TEXT: `
<FORMAT>
Respond in plain text without any special formatting, lists, or structural elements.
</FORMAT>`,

    STEP_BY_STEP: `
<FORMAT>
Break down instructions or processes into a clear, numbered, step-by-step list.
Ensure each step is a distinct, actionable item.
</FORMAT>`,
} as const;
