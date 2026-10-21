const INVISIBLE_CHARS_RE =
    /[\u00AD\u180E\u200B-\u200C\u200E-\u200F\u202A-\u202E\u2060-\u2064\u2066-\u2069\uFEFF]/gu;

// oxlint-disable-next-line no-control-regex -- Intentionally matching control characters for sanitization
const ASCII_CTRL_RE = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/gu;

const SPACE_LIKE_RE = /[\u00A0\u1680\u2000-\u200A\u202F\u205F\u3000]/gu;
const MULTIPLE_SPACES_RE = / {2,}/gu;
const CR_RE = /\r\n?/gu;
const CITATION_RE = / *\(oaicite:\d+\)\{index=\d+\}/gu;
const EM_DASH_SEPARATOR_RE = /\s*[—–―‒]\s*/gu;

const TYPOGRAPHY_REPLACEMENTS: { pattern: RegExp; replacement: string }[] = [
    { pattern: /[\u2018\u2019\u201A]/gu, replacement: "'" },
    { pattern: /[\u201C\u201D\u201E]/gu, replacement: '"' },
    { pattern: /[\u2022\u25AA-\u25AB\u25B8-\u25B9\u25CF]/gu, replacement: '-' },
];

export type CleanAiTextOptions = {
    /** Collapse multiple spaces into one (default: true) */
    collapseSpaces?: boolean;
    /** Convert em/en dashes with spaces to commas (default: true) */
    normalizeEmDashesToCommas?: boolean;
};

/** Strips AI artifacts (citation markers, invisible characters) and normalizes typography. */
export function cleanAiText(text: string, options: CleanAiTextOptions = {}): string {
    const { normalizeEmDashesToCommas = true, collapseSpaces = true } = options;

    let result = text;

    result = result.replaceAll(CR_RE, '\n');
    result = result.replaceAll(CITATION_RE, '');
    result = result.normalize('NFKC');
    result = result.replaceAll(INVISIBLE_CHARS_RE, '');
    result = result.replaceAll(ASCII_CTRL_RE, '');

    if (normalizeEmDashesToCommas) {
        result = result.replaceAll(EM_DASH_SEPARATOR_RE, ', ');
    }

    result = result.replaceAll(SPACE_LIKE_RE, ' ');

    for (const { pattern, replacement } of TYPOGRAPHY_REPLACEMENTS) {
        result = result.replace(pattern, replacement);
    }

    if (collapseSpaces) {
        result = result.replaceAll(MULTIPLE_SPACES_RE, ' ').trim();
    }

    return result;
}
