/**
 * Re-exports for the prompt library.
 * This file serves as the public API for the prompt library,
 * making it easy to import all categories from a single location.
 */

import { DOMAIN } from './categories/domain.js';

import { AGENT_LOGIC } from './categories/agent-logic.js';
import { AGENT_SKILLS } from './categories/agent-skills.js';
import { DIRECTIVES } from './categories/directives.js';
import { FORMAT } from './categories/format.js';
import { LANGUAGE } from './categories/language.js';
import { PERSONA } from './categories/persona.js';
import { PRESETS } from './presets.js';
import { TONE } from './categories/tone.js';
import { VERBOSITY } from './categories/verbosity.js';

export const PROMPTS = {
    AGENT_LOGIC,
    AGENT_SKILLS,
    DIRECTIVES,
    DOMAIN,
    FORMAT,
    LANGUAGE,
    PERSONA,
    PRESETS,
    TONE,
    VERBOSITY,
} as const;
