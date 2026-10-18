import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import nspell from 'nspell';

import { GENERATED_PRESERVED_TERMS } from './preserved-terms.generated.js';

const MANUAL_PRESERVED_TERMS = ['I', 'AI', 'OAuth'];

const WORD_PATTERN = /(?<word>[\p{L}0-9']+)/u;
const HAS_LOWER_THEN_UPPER = /\p{Ll}\p{Lu}/u;
const HAS_UPPER = /\p{Lu}/u;
const HAS_LETTER = /\p{L}/u;
const SENTENCE_END_PATTERN = /[.!?]/u;

type Language = 'en' | 'fr';

const DICTIONARY_PACKAGE: Record<Language, string> = {
    en: 'dictionary-en',
    fr: 'dictionary-fr',
};

const DEFAULT_PRESERVED = new Map(
    [...GENERATED_PRESERVED_TERMS, ...MANUAL_PRESERVED_TERMS].map((term) => [
        term.toLowerCase(),
        term,
    ]),
);

const spellCheckers = new Map<Language, ReturnType<typeof nspell>>();

const nodeRequire = createRequire(import.meta.url);

function loadSpellChecker(language: Language): ReturnType<typeof nspell> {
    const packageEntry = nodeRequire.resolve(DICTIONARY_PACKAGE[language]);
    const packageDir = path.dirname(packageEntry);
    const aff = readFileSync(path.join(packageDir, 'index.aff'));
    const dic = readFileSync(path.join(packageDir, 'index.dic'));
    return nspell({ aff, dic });
}

function getSpellChecker(language: Language): ReturnType<typeof nspell> {
    const checker = spellCheckers.get(language) ?? loadSpellChecker(language);
    // Stryker disable next-line CallExpression: a cache: a checker loaded again answers the same, only slower
    spellCheckers.set(language, checker);
    return checker;
}

function isKnownInAnyLanguage(word: string, languages: readonly Language[]): boolean {
    return languages.some((language) => getSpellChecker(language).correct(word));
}

export type ToSentenceCaseOptions = {
    /** Extra terms whose casing is kept, appended to the defaults unless `replacePreserved` is set; each a single word with no '.', e.g. a proper noun that is also a dictionary word ('Macron'). */
    preservedTerms?: string[];

    /** If true, `preservedTerms` replaces the default list rather than extending it. */
    replacePreserved?: boolean;

    /** Minimum ratio of capitalized words for the input to count as Title Case; default 0.6. */
    titleCaseThreshold?: number;

    /** Below this word count the input is returned unchanged; default 3. */
    minWords?: number;

    /** Spelling dictionaries consulted in order, each loaded on first need; default `['en', 'fr']`. */
    languages?: Language[];
};

type Casing = {
    languages: readonly Language[];
    preserved: (lower: string) => string | undefined;
};

function casingOf(options: ToSentenceCaseOptions): Casing {
    const own = new Map(options.preservedTerms?.map((term) => [term.toLowerCase(), term]));
    const defaults = options.replacePreserved === true ? undefined : DEFAULT_PRESERVED;
    return {
        languages: options.languages ?? ['en', 'fr'],
        preserved: (lower) => own.get(lower) ?? defaults?.get(lower),
    };
}

function isWord(token: string): boolean {
    return WORD_PATTERN.test(token) && HAS_LETTER.test(token);
}

function readsAsTitleCase(words: string[], options: ToSentenceCaseOptions): boolean {
    if (words.length < (options.minWords ?? 3)) {
        return false;
    }
    const capitalized = words.filter((word) => HAS_UPPER.test(word.charAt(0))).length;
    return capitalized / words.length >= (options.titleCaseThreshold ?? 0.6);
}

function caseUnconfirmed(token: string, languages: readonly Language[]): string {
    const lower = token.toLowerCase();
    if (isKnownInAnyLanguage(lower, languages)) {
        return lower;
    }
    const titleCased = token.charAt(0) + token.slice(1).toLowerCase();
    return isKnownInAnyLanguage(titleCased, languages) ? titleCased : token;
}

function caseWord(token: string, startsSentence: boolean, casing: Casing): string {
    const preserved = casing.preserved(token.toLowerCase());
    if (preserved !== undefined) {
        return preserved;
    }
    if (HAS_LOWER_THEN_UPPER.test(token)) {
        return token;
    }
    if (startsSentence) {
        return token.charAt(0).toUpperCase() + token.slice(1).toLowerCase();
    }
    return caseUnconfirmed(token, casing.languages);
}

/** Rewrites Title Case to sentence case, lowercasing only the words a dictionary confirms as common. */
export function toSentenceCase(text: string, options: ToSentenceCaseOptions = {}): string {
    const tokens = text.split(WORD_PATTERN);
    if (!readsAsTitleCase(tokens.filter(isWord), options)) {
        return text;
    }
    const casing = casingOf(options);
    let startsSentence = true;
    return tokens
        .map((token) => {
            if (!isWord(token)) {
                startsSentence ||= SENTENCE_END_PATTERN.test(token);
                return token;
            }
            const cased = caseWord(token, startsSentence, casing);
            startsSentence = false;
            return cased;
        })
        .join('');
}

export type { Language as SentenceCaseLanguage };
