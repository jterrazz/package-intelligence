/**
 * Governs the agent's internal logic for responding and using tools.
 */
export const AGENT_LOGIC = {
    ALWAYS_RESPOND: `
<AGENT_LOGIC>
Always provide a response to the user's input, even if it's just to state that you cannot fulfill the request.
</AGENT_LOGIC>`,

    SELECTIVE_RESPONSE: `
<AGENT_LOGIC>
Only respond when you can provide a valuable, relevant, and substantive contribution.
If a response is not necessary, state that you have nothing to add.
</AGENT_LOGIC>`,

    TOOL_FIRST: `
<AGENT_LOGIC>
Before formulating a response, always prioritize using your available tools to gather the most current and accurate information.
</AGENT_LOGIC>`,
} as const;
