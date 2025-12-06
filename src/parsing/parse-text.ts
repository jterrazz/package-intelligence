const INVISIBLE_CHARS_RE =
    /[\u00AD\u180E\u200B-\u200C\u200E-\u200F\u202A-\u202E\u2060-\u2064\u2066-\u2069\uFEFF]/g;

/* eslint-disable no-control-regex -- intentionally matching control characters */
// biome-ignore lint/suspicious/noControlCharactersInRegex: intentionally matching control characters for sanitization
const ASCII_CTRL_RE = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;
/* eslint-enable no-control-regex */

const SPACE_LIKE_RE = /[\u00A0\u1680\u2000-\u200A\u202F\u205F\u3000]/g;
const MULTIPLE_SPACES_RE = / {2,}/g;
const CR_RE = /\r\n?/g;
const CITATION_RE = / *\(oaicite:\d+\)\{index=\d+\}/g;
const EM_DASH_SEPARATOR_RE = /(?:\s+[—–―‒]\s*|\s*[—–―‒]\s+)/g;

const TYPOGRAPHY_REPLACEMENTS: Array<{ pattern: RegExp; replacement: string }> = [
    { pattern: /[\u2018\u2019\u201A]/g, replacement: "'" },
    { pattern: /[\u201C\u201D\u201E]/g, replacement: '"' },
    { pattern: /[\u2013\u2014]/g, replacement: '-' },
    { pattern: /\u2026/g, replacement: '...' },
    { pattern: /[\u2022\u25AA-\u25AB\u25B8-\u25B9\u25CF]/g, replacement: '-' },
];

export interface ParseTextOptions {
    /** Collapse multiple spaces into one (default: true) */
    collapseSpaces?: boolean;
    /** Convert em/en dashes with spaces to commas (default: true) */
    normalizeEmDashesToCommas?: boolean;
}

/**
 * Parses and sanitizes text by removing AI artifacts and normalizing typography.
 *
 * @param text - The text to parse
 * @param options - Parsing options
 * @returns The cleaned text
 */
export function parseText(text: string, options: ParseTextOptions = {}): string {
    const { normalizeEmDashesToCommas = true, collapseSpaces = true } = options;

    if (!text) return '';

    let result = text;

    if (result.charCodeAt(0) === 0xfeff) {
        result = result.slice(1);
    }

    result = result.replace(CR_RE, '\n');
    result = result.replace(CITATION_RE, '');
    result = result.normalize('NFKC');
    result = result.replace(INVISIBLE_CHARS_RE, '');
    result = result.replace(ASCII_CTRL_RE, '');

    if (normalizeEmDashesToCommas) {
        result = result.replace(EM_DASH_SEPARATOR_RE, ', ');
    }

    result = result.replace(SPACE_LIKE_RE, ' ');

    for (const { pattern, replacement } of TYPOGRAPHY_REPLACEMENTS) {
        result = result.replace(pattern, replacement);
    }

    if (collapseSpaces) {
        result = result.replace(MULTIPLE_SPACES_RE, ' ').trim();
    }

    return result;
}
