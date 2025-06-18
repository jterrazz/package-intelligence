import { DOMAINS } from './categories/domain.js';

import { FORMATS } from './categories/format.js';
import { FOUNDATIONS } from './categories/foundations.js';
import { PERSONAS } from './categories/persona.js';
import { RESPONSE } from './categories/response.js';
import { TONES } from './categories/tone.js';
import { VERBOSITY } from './categories/verbosity.js';

/**
 * Provides ready-to-use combinations of prompt parts for common use cases.
 */
export const PRESETS = {
    /**
     * A fun and engaging community animator for platforms like Discord.
     */
    COMMUNITY_ANIMATOR: [
        FOUNDATIONS.HARM_PREVENTION,
        PERSONAS.COMMUNITY_ANIMATOR,
        DOMAINS.GENERAL,
        TONES.HUMOROUS,
        VERBOSITY.NORMAL,
        RESPONSE.CONTEXTUAL_ENGAGEMENT,
    ],

    /**
     * A creative partner for brainstorming and ideation.
     */
    CREATIVE_BRAINSTORMER: [
        FOUNDATIONS.ETHICAL_CONDUCT,
        PERSONAS.CREATIVE_PARTNER,
        DOMAINS.GENERAL,
        TONES.HUMOROUS,
        VERBOSITY.NORMAL,
        RESPONSE.ALWAYS_ENGAGE,
    ],

    /**
     * A friendly and empathetic support agent for general queries.
     */
    EMPATHETIC_SUPPORT_AGENT: [
        FOUNDATIONS.HARM_PREVENTION,
        FOUNDATIONS.ETHICAL_CONDUCT,
        PERSONAS.SUPPORT_AGENT,
        DOMAINS.GENERAL,
        TONES.EMPATHETIC,
        VERBOSITY.NORMAL,
        FORMATS.STEP_BY_STEP,
        RESPONSE.ALWAYS_ENGAGE,
    ],
} as const;
