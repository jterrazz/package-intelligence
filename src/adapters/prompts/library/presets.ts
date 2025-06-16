import { DOMAIN } from './categories/domain.js';

import { AGENT_LOGIC } from './categories/agent-logic.js';
import { AGENT_SKILLS } from './categories/agent-skills.js';
import { DIRECTIVES } from './categories/directives.js';
import { FORMAT } from './categories/format.js';
import { PERSONA } from './categories/persona.js';
import { TONE } from './categories/tone.js';
import { VERBOSITY } from './categories/verbosity.js';

/**
 * Provides ready-to-use combinations of prompt parts for common use cases.
 */
export const PRESETS = {
    /**
     * A creative partner for brainstorming and ideation.
     */
    CREATIVE_BRAINSTORMER: [
        DIRECTIVES.BE_ETHICAL,
        PERSONA.CREATIVE_PARTNER,
        DOMAIN.GENERAL,
        TONE.HUMOROUS,
        VERBOSITY.NORMAL,
        FORMAT.MARKDOWN,
        AGENT_LOGIC.ALWAYS_RESPOND,
        AGENT_SKILLS.CREATIVE_IDEATION,
    ],

    /**
     * A fun and engaging community animator for platforms like Discord.
     */
    DISCORD_COMMUNITY_ANIMATOR: [
        DIRECTIVES.BE_SAFE,
        PERSONA.COMMUNITY_ANIMATOR,
        DOMAIN.GENERAL,
        TONE.HUMOROUS,
        VERBOSITY.NORMAL,
        FORMAT.MARKDOWN,
        AGENT_LOGIC.ALWAYS_RESPOND,
        AGENT_SKILLS.CREATIVE_IDEATION,
    ],

    /**
     * A friendly and empathetic support agent for general queries.
     */
    EMPATHETIC_SUPPORT_AGENT: [
        DIRECTIVES.BE_SAFE,
        DIRECTIVES.BE_ETHICAL,
        PERSONA.SUPPORT_AGENT,
        DOMAIN.GENERAL,
        TONE.EMPATHETIC,
        VERBOSITY.NORMAL,
        FORMAT.STEP_BY_STEP,
        AGENT_LOGIC.ALWAYS_RESPOND,
        AGENT_SKILLS.PROBLEM_SOLVING,
    ],
} as const;
