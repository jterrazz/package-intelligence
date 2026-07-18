/**
 * Normalize Title Case overuse (a common AI/marketing tic) back to sentence
 * case while preserving acronyms, mixed-case proper nouns, and the first word
 * of each sentence.
 *
 * The function is conservative: it only rewrites strings whose ratio of
 * capitalized words is high enough that the input is unambiguously in Title
 * Case. Normal prose with one or two proper nouns is left untouched.
 *
 * Philosophy (important, and the inverse of the naive approach): we only
 * lowercase a capitalized/ALL-CAPS token when we can positively confirm its
 * lowercase form is a real word — via the generated preserved-terms list, or
 * via an actual EN/FR spelling dictionary lookup (through `nspell`, which
 * expands Hunspell affixes, so inflected forms like "Published" or
 * "Reported" resolve correctly even though only their stems are dictionary
 * headwords). Anything we don't recognize is assumed to be a proper noun and
 * its original casing is preserved. This is deliberately asymmetric:
 * over-capitalizing a rare common word is a mild cosmetic miss, but
 * decapitalizing an unrecognized proper noun (a person, a place, a brand) is
 * an outright factual error. The old approach did the opposite — lowercase
 * by default, preserve only what's on an explicit allowlist — which
 * systematically mangled any proper noun the allowlist didn't happen to
 * cover.
 *
 * Known limitation: proper nouns whose lowercase homograph is a real
 * dictionary word get wrongly lowercased mid-sentence — e.g. "Macron"
 * ("macron" is an English word), "Musk" ("musk" is a fragrance note), "API"
 * ("api" is a dictionary-fr headword). Same class of ambiguity as "Apple"
 * the fruit vs. "Apple" the company; see the test suite for more cases.
 * Callers who need a specific term protected can pass it via
 * `preservedTerms`.
 *
 * Examples:
 *   "Your Next AI Skill Is Worldbuilding" -> "Your next AI skill is Worldbuilding"
 *   "How To Use The API For HTTP Calls"   -> "How to use the API for HTTP calls"
 *   "The OpenAI Revolution"               -> "The OpenAI revolution"
 *   "Macron Meets Zelensky In Kyiv"       -> "Macron meets Zelensky in Kyiv" (see caveat above: "macron" collides with a real word, so it *does* get lowercased — see tests)
 *   "Cursor: the compression of mechanical work" -> unchanged
 *   "AI is making us smarter"             -> unchanged
 */

import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import nspell from 'nspell';

import { GENERATED_PRESERVED_TERMS } from './preserved-terms.generated.js';

/**
 * Terms `npm run generate:terms` (see scripts/generate-preserved-terms.ts)
 * cannot derive from the cspell dictionaries, kept here by hand. Stays
 * short and deliberate on purpose:
 *
 *  - 'I' — the pronoun is always capitalized in English. It's excluded from
 *    the generated list because lowercase "i" is a genuine dictionary
 *    headword (the math/code variable) in both EN and FR, so a plain
 *    spelling-dictionary lookup would incorrectly lowercase it; this one
 *    hardcoded linguistic rule overrides that.
 *  - 'AI' — a real gap: dictionary-en does list uppercase "AI" as a valid
 *    headword these days, but lowercase "ai" is *also* a genuine French verb
 *    form ("j'ai" — I have). With French enabled by default, a plain
 *    dictionary lookup on the lowercased token would find "ai" valid via
 *    French and wrongly lowercase the acronym. The explicit preserved-term
 *    entry (checked before any dictionary access) sidesteps the collision
 *    entirely.
 *  - 'OAuth' — not a dictionary headword in either language, so on its own
 *    it would already survive mid-title via the "unrecognized -> preserve"
 *    default. The entry earns its keep for input that doesn't already use
 *    the canonical casing (e.g. "Oauth"), restoring it to "OAuth".
 *
 * Deliberately NOT re-added, even though they were in the old hardcoded
 * list and cspell doesn't source them either:
 *  - 'Apple', 'Meta', 'Linear', 'Operator', 'Codex', 'Google', 'Slack',
 *    'Notion', 'Cursor', 'Amazon', 'Grok', 'TypeScript', 'Python', 'React'
 *    — each collides with a genuine lowercase English dictionary word
 *    (apple, meta, linear, operator, codex, google, slack, notion, cursor,
 *    amazon, grok, typescript, python, react). Preserving them
 *    unconditionally would wrongly force-capitalize the common word too;
 *    the dictionary-lookup fallback applies the same ambiguity rule
 *    automatically for terms that aren't hand- or cspell-listed.
 *  - 'Node.js', 'Next.js' — can't be represented as a single preserved
 *    term anyway: the tokenizer below splits on '.', so these would only
 *    ever match a lone "Node"/"Next" token. Both "node" and "next" are
 *    common dictionary words, so adding them would incorrectly preserve
 *    ordinary title-case capitalization of unrelated sentences.
 *  - 'iOS', 'macOS' — no longer needed. Both have an internal lower→upper
 *    transition ("iOS", "macOS"), so the mixed-case heuristic (checked
 *    before any dictionary access) already preserves them without an
 *    explicit entry.
 */
const MANUAL_PRESERVED_TERMS = ['I', 'AI', 'OAuth'];

const WORD_PATTERN = /(?<word>[\p{L}0-9']+)/u;
const HAS_LOWER_THEN_UPPER = /\p{Ll}\p{Lu}/u;
const HAS_UPPER = /\p{Lu}/u;
const HAS_LOWER = /\p{Ll}/u;
const HAS_LETTER = /\p{L}/u;
const SENTENCE_END_PATTERN = /[.!?]/;

/**
 * Languages supported for the spelling-dictionary fallback. Publicly
 * exported as `SentenceCaseLanguage` at the bottom of this file (grouping
 * all `export`s there, as required by the lint config).
 */
type Language = 'en' | 'fr';

const DICTIONARY_PACKAGE: Record<Language, string> = {
    en: 'dictionary-en',
    fr: 'dictionary-fr',
};

/**
 * Lazily-built singleton map (lowercase -> canonical casing) for the
 * combined default preserved terms. Built once on first use and reused for
 * every call that doesn't ask to replace the defaults entirely.
 */
let defaultPreservedMap: Map<string, string> | null = null;

function getDefaultPreservedMap(): Map<string, string> {
    if (!defaultPreservedMap) {
        const map = new Map<string, string>();
        for (const term of GENERATED_PRESERVED_TERMS) {
            map.set(term.toLowerCase(), term);
        }
        for (const term of MANUAL_PRESERVED_TERMS) {
            map.set(term.toLowerCase(), term);
        }
        defaultPreservedMap = map;
    }
    return defaultPreservedMap;
}

/**
 * Lazily-constructed, per-language `nspell` singletons. Parsing a Hunspell
 * affix + dictionary file costs roughly 100-300ms, so an instance is only
 * ever built the first time a token *actually* requires a dictionary lookup
 * (never at module import, never at the first `toSentenceCase` call if that
 * call's tokens are all resolved by the cheaper fast paths first). Each
 * language is independent: a call that only uses `languages: ['en']` never
 * pays the French parsing cost, and vice versa.
 */
const spellCheckers = new Map<Language, ReturnType<typeof nspell>>();

/**
 * `dictionary-en`/`dictionary-fr` ship an async default export (they read
 * their `.aff`/`.dic` files with `fs.promises.readFile` at import time), but
 * `toSentenceCase` must stay synchronous. We bypass their package entry
 * point entirely and read the underlying Hunspell data files ourselves with
 * a synchronous `readFileSync`, resolving the package directory via
 * `createRequire` (works from both the ESM and CJS build outputs).
 */
const nodeRequire = createRequire(import.meta.url);

function loadSpellChecker(language: Language): ReturnType<typeof nspell> {
    const packageEntry = nodeRequire.resolve(DICTIONARY_PACKAGE[language]);
    const packageDir = path.dirname(packageEntry);
    const aff = readFileSync(path.join(packageDir, 'index.aff'));
    const dic = readFileSync(path.join(packageDir, 'index.dic'));
    return nspell({ aff, dic });
}

function getSpellChecker(language: Language): ReturnType<typeof nspell> {
    let checker = spellCheckers.get(language);
    if (!checker) {
        checker = loadSpellChecker(language);
        spellCheckers.set(language, checker);
    }
    return checker;
}

/**
 * Memoizes dictionary verdicts (`"<lang>\0<word>"` -> `correct(word)`) since
 * headline-style text repeats the same handful of words constantly. Bounded
 * to avoid unbounded growth across a long-running process; eviction is a
 * simple FIFO (oldest-inserted entry dropped first) rather than true LRU —
 * good enough for this access pattern and far cheaper to maintain.
 */
const MAX_VERDICT_CACHE_ENTRIES = 10_000;
const spellVerdictCache = new Map<string, boolean>();

function isKnownSpelling(word: string, language: Language): boolean {
    const key = `${language} ${word}`;
    const cached = spellVerdictCache.get(key);
    if (cached !== undefined) {
        return cached;
    }

    const verdict = getSpellChecker(language).correct(word);

    if (spellVerdictCache.size >= MAX_VERDICT_CACHE_ENTRIES) {
        const oldestKey = spellVerdictCache.keys().next().value;
        if (oldestKey !== undefined) {
            spellVerdictCache.delete(oldestKey);
        }
    }
    spellVerdictCache.set(key, verdict);

    return verdict;
}

/** Whether `word` is recognized (case-sensitively) by any of `languages`, checked in order. */
function isKnownInAnyLanguage(word: string, languages: readonly Language[]): boolean {
    for (const language of languages) {
        if (isKnownSpelling(word, language)) {
            return true;
        }
    }
    return false;
}

export interface ToSentenceCaseOptions {
    /**
     * Extra terms whose exact casing should be preserved (e.g. brand names).
     * Appended to the default tech-oriented list unless `replacePreserved` is set.
     */
    preservedTerms?: string[];

    /** If true, `preservedTerms` replaces the default list rather than extending it. */
    replacePreserved?: boolean;

    /**
     * Minimum ratio of capitalized words required to classify the input as Title
     * Case. Below this, the input is returned unchanged. Default 0.6.
     */
    titleCaseThreshold?: number;

    /**
     * Minimum word count required to attempt detection. Short strings (titles
     * with 1–2 words, brand lockups) are always returned unchanged. Default 3.
     */
    minWords?: number;

    /**
     * Which spelling dictionaries to consult (in order) when a mid-sentence
     * capitalized/ALL-CAPS token isn't resolved by the preserved-terms list
     * or the mixed-case heuristic. Defaults to `['en', 'fr']`. Loading a
     * dictionary is lazy and costs roughly 100-300ms the first time a
     * language is actually needed (never at import, never for calls whose
     * tokens are all resolved by cheaper checks); each configured language
     * is loaded independently and reused (module-level singleton) for every
     * subsequent call, so pass a narrower list only to skip a language you
     * know you'll never need, not as a per-call performance knob.
     */
    languages?: Language[];
}

/**
 * Normalizes Title Case overuse back to sentence case.
 *
 * @param text - The text to normalize
 * @param options - Normalization options
 * @returns The normalized text, or the original text if it doesn't look like Title Case
 */
export function toSentenceCase(text: string, options: ToSentenceCaseOptions = {}): string {
    if (!text) {
        return text;
    }

    /*
     * Two-tier lookup so the ~2.5k-entry default map is never rebuilt (or
     * copied) per call: a small local map holds only this call's extra
     * `preservedTerms`, and falls back to the lazily-built module-level
     * singleton unless `replacePreserved` opts out of the defaults entirely.
     */
    const localPreservedMap = new Map<string, string>();
    for (const term of options.preservedTerms ?? []) {
        localPreservedMap.set(term.toLowerCase(), term);
    }
    const defaultMap = options.replacePreserved ? null : getDefaultPreservedMap();
    const lookupPreserved = (lower: string): string | undefined =>
        localPreservedMap.get(lower) ?? defaultMap?.get(lower);

    const threshold = options.titleCaseThreshold ?? 0.6;
    const minWords = options.minWords ?? 3;
    const languages = options.languages ?? ['en', 'fr'];

    /*
     * Split, keeping separators as tokens. With a capture group every other
     * entry is a word; runs in between are non-word separators (spaces, punct).
     */
    const tokens = text.split(WORD_PATTERN);
    const wordTokens = tokens.filter((t) => WORD_PATTERN.test(t) && HAS_LETTER.test(t));

    if (wordTokens.length < minWords) {
        return text;
    }

    const capitalizedCount = wordTokens.filter((t) => HAS_UPPER.test(t[0] ?? '')).length;
    const ratio = capitalizedCount / wordTokens.length;
    if (ratio < threshold) {
        return text;
    }

    let isFirstWord = true;
    let nextStartsSentence = false;

    return tokens
        .map((tok) => {
            if (!WORD_PATTERN.test(tok) || !HAS_LETTER.test(tok)) {
                if (SENTENCE_END_PATTERN.test(tok)) {
                    nextStartsSentence = true;
                }
                return tok;
            }

            const startsNewSentence = isFirstWord || nextStartsSentence;
            isFirstWord = false;
            nextStartsSentence = false;

            /*
             * 1. Preserved terms (case-insensitive lookup, returns canonical
             * casing). Checked unconditionally, ahead of the sentence-start
             * rule, so a known term at the start of a sentence still gets its
             * canonical casing (e.g. "iPhone Review" keeps "iPhone", not
             * "Iphone").
             */
            const preserved = lookupPreserved(tok.toLowerCase());
            if (preserved) {
                return preserved;
            }

            /*
             * 2. Mixed case (camelCase, "iPhone", "ChatGPT") — preserve
             * verbatim. We require an internal lower→upper transition; pure
             * "Word" or "WORD" patterns fall through to the rules below.
             */
            if (HAS_LOWER_THEN_UPPER.test(tok)) {
                return tok;
            }

            /*
             * 3. Start of a sentence — capitalize first letter, lowercase
             * rest. Unconditional: the first word of a sentence is always
             * capitalized regardless of what any dictionary says about it.
             */
            if (startsNewSentence) {
                return tok[0].toUpperCase() + tok.slice(1).toLowerCase();
            }

            /*
             * 4. Fast path: token is already all-lowercase (the overwhelming
             * majority of tokens in real prose) — nothing to decide, and no
             * dictionary access needed.
             */
            if (!HAS_UPPER.test(tok)) {
                return tok;
            }

            /*
             * 5. Dictionary fallback — the core of the "only lowercase what
             * we know is common" philosophy. Only reached for a capitalized
             * or ALL-CAPS token that isn't a preserved term, isn't
             * mixed-case, and isn't the start of a sentence.
             */
            const isAllCaps = !HAS_LOWER.test(tok) && tok.length >= 2;

            if (isAllCaps) {
                /*
                 * ALL-CAPS (>= 2 letters): lowercase if the lowercase form is
                 * a known word ("BREAKING" -> "breaking"); otherwise try
                 * restoring ordinary title casing if *that* is known
                 * ("LONDON" -> "London"); otherwise assume it's an acronym we
                 * don't recognize and leave it untouched ("GRPC" stays
                 * "GRPC"). Over-capitalizing a rare word is a cosmetic miss;
                 * decapitalizing an unrecognized proper noun is a factual
                 * error — so unknown ALL-CAPS is preserved, not lowercased,
                 * unlike the old blanket "shouting" heuristic.
                 */
                const lower = tok.toLowerCase();
                if (isKnownInAnyLanguage(lower, languages)) {
                    return lower;
                }
                const titleCased = tok[0] + tok.slice(1).toLowerCase();
                if (isKnownInAnyLanguage(titleCased, languages)) {
                    return titleCased;
                }
                return tok;
            }

            /*
             * Capitalized (initial upper, no internal lower→upper
             * transition): lowercase only if the lowercase form is a known
             * common word ("The" -> "the", "Reported" -> "reported" via
             * affix expansion); otherwise assume it's a proper noun we don't
             * recognize and preserve the original casing verbatim ("Macron"
             * mid-sentence stays "Macron", "Zelensky" stays "Zelensky").
             */
            const lower = tok.toLowerCase();
            if (isKnownInAnyLanguage(lower, languages)) {
                return lower;
            }
            return tok;
        })
        .join('');
}

export type { Language as SentenceCaseLanguage };
