/**
 * Re-exports for the prompt library.
 * This file serves as the public API for the prompt library,
 * making it easy to import all categories from a single location.
 */

import { DOMAINS } from './categories/domain.js';

import { FORMATS } from './categories/format.js';
import { FOUNDATIONS } from './categories/foundations.js';
import { LANGUAGES } from './categories/language.js';
import { PERSONAS } from './categories/persona.js';
import { RESPONSE } from './categories/response.js';
import { TONES } from './categories/tone.js';
import { VERBOSITY } from './categories/verbosity.js';

import { PRESETS } from './presets.js';

export const PROMPTS = {
    DOMAINS,
    FORMATS,
    FOUNDATIONS,
    LANGUAGES,
    PERSONAS,
    PRESETS,
    RESPONSE_STRATEGIES: RESPONSE,
    TONES,
    VERBOSITY_LEVELS: VERBOSITY,
} as const;
