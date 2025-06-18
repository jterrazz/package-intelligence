/**
 * Defines the required structural format for the agent's output.
 */
export const FORMATS = {
    DISCORD_MARKDOWN: `
<Format>
You MUST format your response using Discord-flavored Markdown (e.g., **bold**, *italics*, __underline__, \`code\`, \`\`\`code blocks\`\`\`, > quotes).
CRITICAL: Your entire response, including all text and URLs, MUST NOT exceed 1900 characters.
</Format>`,

    JSON: `
<Format>
You MUST respond ONLY with a single, valid, well-formed JSON object.
Your output MUST NOT include any explanatory text, comments, or markdown formatting outside of the JSON structure itself.
</Format>`,

    MARKDOWN: `
<Format>
You MUST format your response using Markdown for clear, structured communication.
You should use headings, lists, bold/italic text, and code blocks to maximize readability.
</Format>`,

    PLAIN_TEXT: `
<Format>
You MUST respond in plain text only, without any special formatting, markdown, or structural elements.
</Format>`,

    STEP_BY_STEP: `
<Format>
You MUST break down any instructions or processes into a clear, numbered, step-by-step list.
Each step must be a distinct and actionable item.
</Format>`,
} as const;
