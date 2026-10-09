import { file } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

import type { ToSentenceCaseOptions } from '../../../src/index.formatting.js';
import { toSentenceCase } from '../../../src/index.formatting.js';
import { integration } from '../integration.specification.js';

type Case = { name: string; options?: ToSentenceCaseOptions; title: string };

const TRIVIAL: Case[] = [
    { name: 'three-word-title', title: 'Building Great Software' },
    { name: 'empty-string', title: '' },
    { name: 'single-word', title: 'Worldbuilding' },
    { name: 'two-word-title', title: 'Building Software' },
];

const DETECTION: Case[] = [
    { name: 'ratio-exactly-at-the-threshold', title: 'Rust Makes Systems programming fun' },
    { name: 'prose-with-one-proper-noun', title: 'Cursor: the compression of mechanical work' },
    { name: 'prose-opening-on-an-acronym', title: 'AI is making us smarter' },
    { name: 'prose-under-the-threshold', title: 'I talked to Google last week' },
    { name: 'fully-capitalized-title', title: 'Your Next AI Skill Is Worldbuilding' },
    { name: 'title-case-with-an-article', title: 'Two Years of Building Agents' },
];

const ACRONYMS: Case[] = [
    {
        name: 'acronym-colliding-with-a-dictionary-word',
        title: 'How To Use The API For HTTP Calls',
    },
    { name: 'acronyms-from-the-manual-list', title: 'A Tour Of CLI And MCP Workflows' },
    { name: 'mixed-case-acronym', title: 'The OAuth Spec Is Confusing' },
];

const PROPER_NOUNS: Case[] = [
    { name: 'all-caps-name-known-in-title-case', title: 'We Met AL In Town Today' },
    { name: 'openai-preserved', title: 'The OpenAI Revolution Is Here' },
    { name: 'chatgpt-preserved', title: 'Why ChatGPT Changed Everything' },
    { name: 'brand-as-the-first-word', title: 'Google Released Another Model' },
    { name: 'mixed-case-survives-a-dictionary-word', title: 'Building With TypeScript And React' },
    { name: 'brand-colliding-with-a-common-noun', title: 'The Apple Orchard Is Beautiful' },
    { name: 'brands-colliding-with-common-words', title: 'The Linear Codex Operator Manual' },
    { name: 'https-from-computing-acronyms', title: 'A Guide To HTTPS Everywhere Today' },
    { name: 'github-from-companies', title: 'Why GitHub Changed Open Source' },
    { name: 'openai-from-companies', title: 'The OpenAI Revolution Continues Today' },
];

const FIRST_WORD: Case[] = [
    { name: 'numbers-outnumbering-the-words', title: 'Best 100 200 300 Tools Ever' },
    { name: 'lowercase-initial-brands-leading-the-title', title: 'iPhone iPad macOS Are Great' },
    {
        name: 'acronym-from-the-dictionaries-as-the-first-word',
        title: 'ACM Publishes Its Annual Report',
    },
    { name: 'mixed-case-term-as-the-first-word', title: 'OAuth Is Confusing For Everyone' },
    { name: 'numbers-between-the-words', title: 'In 2024 We Shipped 3 New Features' },
    { name: 'untriggered-lowercase-opening', title: 'your next AI skill is Worldbuilding' },
    { name: 'shouting-title', title: 'YOUR NEXT AI SKILL IS WORLDBUILDING' },
    { name: 'pronoun-i-mid-title', title: 'Things I Like About Markdown' },
    { name: 'pronoun-i-as-the-first-word', title: 'I Built A Thing' },
    { name: 'after-a-period', title: 'First Half. Second Half Continues' },
    { name: 'after-a-question-mark', title: 'What Now? Find Out Below' },
    { name: 'after-an-exclamation', title: 'Big News! Read This Carefully' },
];

const MIXED_CASE: Case[] = [
    { name: 'unknown-mixed-case-token', title: 'Welcome To MyBrandName Today' },
    { name: 'lowercase-initial-mixed-case', title: 'The iPhone Changed Everything' },
    { name: 'mixed-case-on-the-heuristic-alone', title: 'Try Our New unKnownBrand Today' },
];

const ALL_CAPS: Case[] = [
    { name: 'all-caps-known-word', title: 'ACME PRODUCT LAUNCH IS HERE TODAY' },
    { name: 'all-caps-unknown-token', title: 'TODAY BREAKING NEWS ABOUT ZXQW PROTOCOL' },
    { name: 'all-caps-known-word-and-place', title: 'TODAY BREAKING NEWS FROM LONDON CITY' },
    { name: 'all-caps-french-collision', title: 'BREAKING NEWS FROM CANNES TODAY' },
    {
        name: 'all-caps-french-collision-in-english',
        options: { languages: ['en'] },
        title: 'BREAKING NEWS FROM CANNES TODAY',
    },
    { name: 'all-caps-canonical-casing', title: 'GITHUB CHANGED OPEN SOURCE FOREVER' },
    { name: 'already-lowercase-token', title: 'The api Documentation Was Updated Today' },
];

const PUNCTUATION: Case[] = [
    { name: 'contraction', title: "It's A Beautiful Day" },
    { name: 'colon-separated-segments', title: 'Cursor: The Compression Of Mechanical Work' },
    { name: 'hyphenated-compound', title: 'An AI-Powered World Awaits' },
];

const DICTIONARY: Case[] = [
    { name: 'unrecognized-person-and-place', title: 'Macron Meets Zelensky Over Ukraine Support' },
    {
        name: 'name-colliding-with-a-common-noun',
        title: 'The French President Macron Announced New Measures',
    },
    { name: 'inflected-forms-via-affixes', title: 'New Report Was Published And Widely Reported' },
    { name: 'french-words-and-a-french-name', title: 'The Nouvelle Étude About Bretagne' },
    {
        name: 'french-words-without-the-french-dictionary',
        options: { languages: ['en'] },
        title: 'The Nouvelle Étude About Bretagne',
    },
];

const OPTIONS: Case[] = [
    {
        name: 'extra-preserved-terms',
        options: { preservedTerms: ['Acme'] },
        title: 'The Acme Foo Bar Baz Is Released',
    },
    {
        name: 'replace-preserved-drops-the-manual-list',
        options: { preservedTerms: [], replacePreserved: true },
        title: 'Your Next AI Skill Is Worldbuilding',
    },
    {
        name: 'replace-preserved-keeps-mixed-case',
        options: { preservedTerms: [], replacePreserved: true },
        title: 'The OpenAI Revolution Begins',
    },
    {
        name: 'mixed-ratio-at-the-default-threshold',
        title: 'Some Words Are Capitalized but others not',
    },
    {
        name: 'mixed-ratio-under-a-lower-threshold',
        options: { titleCaseThreshold: 0.4 },
        title: 'Some Words Are Capitalized but others not',
    },
    {
        name: 'four-words-under-a-raised-min-words',
        options: { minWords: 5 },
        title: 'Hello World And You',
    },
];

const CORPUS: Case[] = [
    { name: 'article-mapping-the-noise', title: 'Mapping the noise' },
    { name: 'article-four-levels-of-ai-mastery', title: 'The four levels of AI mastery' },
    { name: 'article-when-ai-becomes-the-product', title: 'When AI becomes the product' },
];

const CASES: Case[] = [
    ...TRIVIAL,
    ...DETECTION,
    ...ACRONYMS,
    ...PROPER_NOUNS,
    ...FIRST_WORD,
    ...MIXED_CASE,
    ...ALL_CAPS,
    ...PUNCTUATION,
    ...DICTIONARY,
    ...OPTIONS,
    ...CORPUS,
];

describe('to-sentence-case', () => {
    test.each(CASES)('sentence-cases the $name case', async ({ name, options, title }) => {
        // Given - one row of the table, with the options that row states
        const result = await integration.call(() => toSentenceCase(title, options));

        // Then - the golden recorded for that row
        expect(result.value).toMatch(file(`./__expected__/${name}.txt`));
        expect(result.error.text).toBe('');
    });
});
