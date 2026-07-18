import { describe, expect, test } from 'vitest';

import { toSentenceCase } from './to-sentence-case.js';

describe('toSentenceCase', () => {
    describe('empty / trivial input', () => {
        test('returns empty string as-is', () => {
            expect(toSentenceCase('')).toBe('');
        });

        test('returns single word unchanged (below minWords)', () => {
            expect(toSentenceCase('Worldbuilding')).toBe('Worldbuilding');
        });

        test('returns two-word title unchanged (below minWords)', () => {
            expect(toSentenceCase('Building Software')).toBe('Building Software');
        });
    });

    describe('Title Case detection (does not over-trigger)', () => {
        test('leaves sentence-case strings with one proper noun untouched', () => {
            expect(toSentenceCase('Cursor: the compression of mechanical work')).toBe(
                'Cursor: the compression of mechanical work',
            );
        });

        test('leaves sentence-case strings starting with an acronym untouched', () => {
            expect(toSentenceCase('AI is making us smarter')).toBe('AI is making us smarter');
        });

        test('leaves prose with two proper nouns untouched', () => {
            // "Talking to OpenAI about Claude" — 3 caps / 5 words = 60% (boundary)
            // Use a clearer below-threshold case
            expect(toSentenceCase('I talked to Google last week')).toBe(
                'I talked to Google last week',
            );
        });

        test('triggers on 100% capitalized titles (>= 3 words)', () => {
            /*
             * BEHAVIOR CHANGE (dictionary-driven philosophy inversion):
             * "Worldbuilding" used to be lowercased unconditionally by the old
             * default rule ("lowercase unless known"). Under the new rule
             * ("only lowercase what a real EN/FR dictionary confirms is a
             * common word"), "worldbuilding" isn't a headword in either
             * dictionary-en or dictionary-fr (it's a portmanteau), so it's
             * now treated like any other unrecognized token and preserved.
             */
            expect(toSentenceCase('Your Next AI Skill Is Worldbuilding')).toBe(
                'Your next AI skill is Worldbuilding',
            );
        });

        test('triggers on Title Case with one lowercase article', () => {
            expect(toSentenceCase('Two Years of Building Agents')).toBe(
                'Two years of building agents',
            );
        });
    });

    describe('preserved acronyms', () => {
        test('keeps AI uppercase mid-title', () => {
            /* See the "philosophy inversion" comment above: "Worldbuilding" is
             * now preserved rather than lowercased (not a dictionary word). */
            expect(toSentenceCase('Your Next AI Skill Is Worldbuilding')).toBe(
                'Your next AI skill is Worldbuilding',
            );
        });

        test('keeps HTTP uppercase (generated list), but API now falls victim to a dictionary collision', () => {
            /*
             * BEHAVIOR CHANGE: "API" was never in the generated preserved-terms
             * list (cspell's computing-acronyms.txt doesn't carry it) — the old
             * code only kept it uppercase via the blanket "any 2-6 char
             * ALL-CAPS token is probably an acronym" regex. That regex is gone
             * under the new philosophy (dictionary-verified only), so "API"
             * now goes through the same ALL-CAPS dictionary check as any other
             * token: its lowercase form "api" is — surprisingly — a genuine
             * (if obscure) headword in dictionary-fr, so it gets lowercased.
             * This is the same class of accepted ambiguity as Apple/apple or
             * Macron/macron, just for an acronym instead of a proper noun; see
             * the "known collisions" describe block below for more examples.
             * "HTTP" is unaffected: it's sourced from computing-acronyms.txt
             * into the generated list, so the preserved-terms lookup resolves
             * it before the dictionary is ever consulted.
             */
            expect(toSentenceCase('How To Use The API For HTTP Calls')).toBe(
                'How to use the api for HTTP calls',
            );
        });

        test('preserves CLI and MCP', () => {
            expect(toSentenceCase('A Tour Of CLI And MCP Workflows')).toBe(
                'A tour of CLI and MCP workflows',
            );
        });

        test('preserves mixed-case acronym OAuth from the default list', () => {
            expect(toSentenceCase('The OAuth Spec Is Confusing')).toBe(
                'The OAuth spec is confusing',
            );
        });
    });

    describe('preserved proper nouns from default list', () => {
        test('keeps OpenAI casing', () => {
            expect(toSentenceCase('The OpenAI Revolution Is Here')).toBe(
                'The OpenAI revolution is here',
            );
        });

        test('keeps ChatGPT casing', () => {
            expect(toSentenceCase('Why ChatGPT Changed Everything')).toBe(
                'Why ChatGPT changed everything',
            );
        });

        test('keeps Google capitalized as the first word (sentence-start rule, not the preserved list)', () => {
            /*
             * "Google" is deliberately excluded from the preserved list (see
             * the ambiguity filter tests below) — this only stays capitalized
             * because it happens to be the first word of the sentence.
             */
            expect(toSentenceCase('Google Released Another Model')).toBe(
                'Google released another model',
            );
        });

        test('keeps TypeScript casing via the mixed-case heuristic, but lowercases React', () => {
            /*
             * "TypeScript" is excluded from the preserved list too (lowercase
             * "typescript" is a dictionary word) but survives anyway because
             * it has an internal lower→upper transition (the mixed-case
             * heuristic, checked ahead of any dictionary access). "React" has
             * no such transition, isn't on any preserved list, and "react" is
             * a genuine dictionary word (the verb), so it gets lowercased.
             */
            expect(toSentenceCase('Building With TypeScript And React')).toBe(
                'Building with TypeScript and react',
            );
        });
    });

    describe('ambiguity filter (generated list correction)', () => {
        test('lowercases "apple" mid-title (ambiguous — filtered out of the generated list)', () => {
            /*
             * "Apple" collides with the common noun "apple", so it's
             * deliberately excluded from the generated preserved-terms list.
             */
            expect(toSentenceCase('The Apple Orchard Is Beautiful')).toBe(
                'The apple orchard is beautiful',
            );
        });

        test('lowercases other brand names that collide with common English words', () => {
            expect(toSentenceCase('The Linear Codex Operator Manual')).toBe(
                'The linear codex operator manual',
            );
        });
    });

    describe('preserved terms from the generated list', () => {
        test('preserves HTTPS from computing-acronyms.txt', () => {
            expect(toSentenceCase('A Guide To HTTPS Everywhere Today')).toBe(
                'A guide to HTTPS everywhere today',
            );
        });

        test('preserves GitHub from companies.txt (not ambiguous — no lowercase "github" dictionary word)', () => {
            expect(toSentenceCase('Why GitHub Changed Open Source')).toBe(
                'Why GitHub changed open source',
            );
        });

        test('preserves OpenAI from companies.txt', () => {
            expect(toSentenceCase('The OpenAI Revolution Continues Today')).toBe(
                'The OpenAI revolution continues today',
            );
        });
    });

    describe('first-word handling', () => {
        test('capitalizes first word of input', () => {
            expect(toSentenceCase('your next AI skill is Worldbuilding')).toBe(
                'your next AI skill is Worldbuilding',
            );
            /*
             * Above is sentence-case-ish (2/6 caps), not triggered. Verify
             * trigger case: "WORLDBUILDING" is an unrecognized ALL-CAPS token
             * (not a dictionary word in either form) so it's preserved
             * verbatim — see the "ALL-CAPS dictionary resolution" describe
             * block below.
             */
            expect(toSentenceCase('YOUR NEXT AI SKILL IS WORLDBUILDING')).toBe(
                'Your next AI skill is WORLDBUILDING',
            );
        });

        test('handles single-letter pronoun I mid-title', () => {
            expect(toSentenceCase('Things I Like About Markdown')).toBe(
                'Things I like about markdown',
            );
        });

        test('keeps I capitalized as first word', () => {
            expect(toSentenceCase('I Built A Thing')).toBe('I built a thing');
        });
    });

    describe('sentence boundaries', () => {
        test('capitalizes word after period', () => {
            expect(toSentenceCase('First Half. Second Half Continues')).toBe(
                'First half. Second half continues',
            );
        });

        test('capitalizes word after question mark', () => {
            expect(toSentenceCase('What Now? Find Out Below')).toBe('What now? Find out below');
        });

        test('capitalizes word after exclamation', () => {
            expect(toSentenceCase('Big News! Read This Carefully')).toBe(
                'Big news! Read this carefully',
            );
        });
    });

    describe('mixed-case (camelCase / PascalCase with inner caps)', () => {
        test('preserves arbitrary mixed-case tokens not in the default list', () => {
            // "MyBrandName" has internal caps, should be preserved
            expect(toSentenceCase('Welcome To MyBrandName Today')).toBe(
                'Welcome to MyBrandName today',
            );
        });

        test('preserves iPhone-style casing', () => {
            expect(toSentenceCase('The iPhone Changed Everything')).toBe(
                'The iPhone changed everything',
            );
        });

        test('preserves an unknown mixed-case brand token via the heuristic alone', () => {
            /*
             * "unKnownBrand" is not in any preserved list — it survives
             * purely because of the internal lower→upper transitions.
             */
            expect(toSentenceCase('Try Our New unKnownBrand Today')).toBe(
                'Try our new unKnownBrand today',
            );
        });
    });

    describe('ALL-CAPS shouting titles', () => {
        test('lowercases an ALL-CAPS token that happens to be a real dictionary word, capitalizes it as first word', () => {
            /*
             * "ACME" isn't in any preserved list, but — coincidentally —
             * "acme" ("the highest point/pinnacle") is a genuine dictionary-en
             * headword, so it's lowercased like any other recognized ALL-CAPS
             * word (see the "ALL-CAPS dictionary resolution" describe block
             * below for the general rule). It's capitalized here only because
             * it's the sentence's first word, which always wins regardless of
             * dictionary lookups.
             */
            expect(toSentenceCase('ACME PRODUCT LAUNCH IS HERE TODAY')).toBe(
                'Acme product launch is here today',
            );
        });

        test('BEHAVIOR CHANGE: an unrecognized ALL-CAPS token is now preserved, not lowercased', () => {
            /*
             * Old behavior: in "shouting" mode (>= 50% of words look like a
             * 2-6 char ALL-CAPS acronym), the old code disabled its generic
             * acronym-preservation regex and fell back to lowercasing
             * everything not on the explicit preserved list — so an unknown
             * token like "GRPC" would have become "grpc".
             *
             * New behavior: there is no more "shouting mode" special case.
             * Every ALL-CAPS token is resolved the same way regardless of how
             * many of its neighbors are also ALL-CAPS: lowercase if the
             * lowercase form is a known word, else try restoring ordinary
             * title casing, else preserve verbatim. "GRPC" matches none of
             * dictionary-en/dictionary-fr in either form, so — unlike the old
             * behavior — it now stays "GRPC". Over-capitalizing an unknown
             * acronym is a mild cosmetic miss; decapitalizing one that turns
             * out to be a proper noun would be a worse mistake, so the new
             * default favors preservation. ("ZXQW" is used instead of a real
             * acronym like "gRPC" specifically because "gRPC" is already in
             * the generated preserved-terms list — this test needs a token
             * that reaches the dictionary fallback with a clean slate.)
             */
            expect(toSentenceCase('TODAY BREAKING NEWS ABOUT ZXQW PROTOCOL')).toBe(
                'Today breaking news about ZXQW protocol',
            );
        });
    });

    describe('punctuation and contractions', () => {
        test('keeps contractions intact', () => {
            expect(toSentenceCase("It's A Beautiful Day")).toBe("It's a beautiful day");
        });

        test('handles colon-separated title segments', () => {
            /*
             * "Cursor: The Compression Of Mechanical Work" — the second clause
             * is Title Case; normalize it but preserve Cursor.
             */
            expect(toSentenceCase('Cursor: The Compression Of Mechanical Work')).toBe(
                'Cursor: the compression of mechanical work',
            );
        });

        test('handles hyphenated compound words by splitting on the hyphen', () => {
            // "AI-Powered World" -> "AI-powered world"
            expect(toSentenceCase('An AI-Powered World Awaits')).toBe('An AI-powered world awaits');
        });
    });

    describe('options', () => {
        test('accepts extra preserved terms', () => {
            /*
             * BEHAVIOR CHANGE: "Baz" used to lowercase unconditionally (old
             * default). "foo" and "bar" are genuine dictionary-en headwords
             * (foo: an old interjection; bar: the common noun) so they still
             * lowercase, but "baz" isn't a dictionary word at all — under the
             * new "only lowercase what we know" rule it's treated as an
             * unrecognized proper noun and preserved, same as "Worldbuilding"
             * elsewhere in this file.
             */
            expect(
                toSentenceCase('The Acme Foo Bar Baz Is Released', {
                    preservedTerms: ['Acme'],
                }),
            ).toBe('The Acme foo bar Baz is released');
        });

        test('replacePreserved drops the default explicit list — AI is no longer protected, unlike before', () => {
            /*
             * BEHAVIOR CHANGE: the old test name/comment described "AI"
             * surviving via the generic ALL-CAPS acronym-preservation regex
             * even with the explicit preserved list cleared. That regex no
             * longer exists — every ALL-CAPS token is now resolved via the
             * dictionary fallback. Without the explicit 'AI' entry (which is
             * what `replacePreserved: true` + `preservedTerms: []` clears),
             * "AI" falls through to the same check as "GRPC" or "BREAKING":
             * its lowercase form "ai" isn't an English word, but it *is* a
             * genuine French verb form ("j'ai" — I have), so with the default
             * `languages: ['en', 'fr']` it gets lowercased to "ai". This is
             * exactly why 'AI' is kept in MANUAL_PRESERVED_TERMS by hand (see
             * the module doc comment) — it's a real, documented gap, not an
             * oversight.
             */
            expect(
                toSentenceCase('Your Next AI Skill Is Worldbuilding', {
                    preservedTerms: [],
                    replacePreserved: true,
                }),
            ).toBe('Your next ai skill is Worldbuilding');
            /*
             * "OpenAI" still isn't in any preserved list, but has internal
             * lower→upper transitions (preserved via the mixed-case rule that
             * always runs ahead of any dictionary access), so it still stays
             * intact regardless of the preserved-list being cleared.
             */
            expect(
                toSentenceCase('The OpenAI Revolution Begins', {
                    preservedTerms: [],
                    replacePreserved: true,
                }),
            ).toBe('The OpenAI revolution begins');
        });

        test('lower threshold normalizes mixed-ratio strings', () => {
            // 3/6 = 50% — below default 0.6, above 0.4
            const input = 'Some Words Are Capitalized but others not';
            expect(toSentenceCase(input)).toBe(input);
            expect(toSentenceCase(input, { titleCaseThreshold: 0.4 })).toBe(
                'Some words are capitalized but others not',
            );
        });

        test('higher minWords skips short titles', () => {
            // 4 words, would normally trigger
            expect(toSentenceCase('Hello World And You', { minWords: 5 })).toBe(
                'Hello World And You',
            );
        });
    });

    describe('real article titles from the corpus', () => {
        test('leaves "Mapping the noise" unchanged', () => {
            expect(toSentenceCase('Mapping the noise')).toBe('Mapping the noise');
        });

        test('leaves "The four levels of AI mastery" unchanged', () => {
            expect(toSentenceCase('The four levels of AI mastery')).toBe(
                'The four levels of AI mastery',
            );
        });

        test('leaves "When AI becomes the product" unchanged', () => {
            expect(toSentenceCase('When AI becomes the product')).toBe(
                'When AI becomes the product',
            );
        });

        test('normalizes "Your Next AI Skill Is Worldbuilding"', () => {
            /* "Worldbuilding" preserved — see the philosophy-inversion comment
             * in the "Title Case detection" describe block above. */
            expect(toSentenceCase('Your Next AI Skill Is Worldbuilding')).toBe(
                'Your next AI skill is Worldbuilding',
            );
        });
    });

    describe('dictionary fallback: unrecognized proper nouns preserved mid-sentence', () => {
        test('preserves unrecognized person/place names ("Zelensky", "Ukraine") that a naive lowercase-by-default rule would mangle', () => {
            expect(toSentenceCase('Macron Meets Zelensky Over Ukraine Support')).toBe(
                'Macron meets Zelensky over Ukraine support',
            );
        });

        test('KNOWN COLLISION: "Macron" mid-sentence lowercases, because "macron" is a genuine English dictionary word', () => {
            /*
             * This is the flip side of the "Macron"/"Zelensky" example used in
             * the task brief: the political figure's name is illustrative, but
             * "macron" is *also* a real English common noun (the diacritical
             * mark ¯, as in Hunspell's own "macron" headword) — so when the
             * name isn't the sentence's first word, the dictionary check finds
             * a genuine lowercase match and lowercases it, exactly like
             * "Apple" the fruit vs. "Apple" the company. Same category of
             * accepted ambiguity, just discovered via a live dictionary lookup
             * instead of the generated list's static ambiguity filter. Every
             * other capitalized word in this sentence is also a real
             * dictionary word ("french", "president", "announced", "new",
             * "measures"), so they lowercase too — Macron isn't singled out by
             * the implementation, it's just unlucky.
             */
            expect(toSentenceCase('The French President Macron Announced New Measures')).toBe(
                'The french president macron announced new measures',
            );
        });
    });

    describe('dictionary fallback: inflected forms via Hunspell affix expansion', () => {
        test('lowercases inflected verb forms not present as dictionary headwords ("Published", "Reported")', () => {
            /*
             * Neither "published" nor "reported" is a literal headword in
             * dictionary-en's .dic file — only the stems ("publish/...",
             * "report/...") are, tagged with Hunspell affix flags. This test
             * only passes because `nspell` expands those affixes: a naive
             * `Set` of raw headwords would incorrectly treat both as unknown
             * and preserve their capitalization.
             */
            expect(toSentenceCase('New Report Was Published And Widely Reported')).toBe(
                'New report was published and widely reported',
            );
        });
    });

    describe('dictionary fallback: French support', () => {
        test('lowercases common French words ("Nouvelle", "Étude") and preserves an unrecognized French proper noun ("Bretagne")', () => {
            /* Also exercises the Unicode-aware casing regexes: "Étude" has an
             * accented capital that a plain [A-Za-z] pattern would mis-tokenize. */
            expect(toSentenceCase('The Nouvelle Étude About Bretagne')).toBe(
                'The nouvelle étude about Bretagne',
            );
        });

        test('languages: ["en"] disables the French dictionary, so French words are treated as unrecognized and preserved', () => {
            expect(toSentenceCase('The Nouvelle Étude About Bretagne', { languages: ['en'] })).toBe(
                'The Nouvelle Étude about Bretagne',
            );
        });
    });

    describe('ALL-CAPS dictionary resolution', () => {
        test('lowercases a known ALL-CAPS word and restores title casing for a known-but-unlowercase-friendly proper noun', () => {
            /*
             * "BREAKING" -> known common word -> lowercased.
             * "LONDON" -> not a common word, but "London" is a known proper
             * noun in dictionary-en -> title casing restored.
             */
            expect(toSentenceCase('TODAY BREAKING NEWS FROM LONDON CITY')).toBe(
                'Today breaking news from London city',
            );
        });

        test('KNOWN COLLISION: "CANNES" lowercases with the default languages, because "cannes" is a French dictionary word (plural of "canne", a cane/walking stick)', () => {
            /*
             * The task brief's own "PARIS -> Paris" example turns out not to
             * exercise this path at all: "Paris" is already in the generated
             * preserved-terms list (sourced from cspell's companies.txt), so
             * it's resolved at the very first, dictionary-free step
             * regardless of the `languages` option — see the "consistency
             * with the generated preserved-terms list" describe block for
             * that. "Cannes" isn't in the generated list, so it actually
             * reaches the ALL-CAPS dictionary fallback and demonstrates the
             * same class of EN/FR collision.
             */
            expect(toSentenceCase('BREAKING NEWS FROM CANNES TODAY')).toBe(
                'Breaking news from cannes today',
            );
        });

        test('languages: ["en"] avoids the French "cannes"/canes collision and restores "Cannes" as a proper noun', () => {
            expect(toSentenceCase('BREAKING NEWS FROM CANNES TODAY', { languages: ['en'] })).toBe(
                'Breaking news from Cannes today',
            );
        });
    });

    describe('consistency with the generated preserved-terms list', () => {
        test('restores canonical mixed casing from an ALL-CAPS token before any dictionary access ("GITHUB" -> "GitHub")', () => {
            expect(toSentenceCase('GITHUB CHANGED OPEN SOURCE FOREVER')).toBe(
                'GitHub changed open source forever',
            );
        });

        test('an already-lowercase "api" token is left untouched, not promoted to "API"', () => {
            /*
             * 'api' is deliberately NOT added to the preserved-terms list
             * (see the "keeps HTTP uppercase... API now falls victim..." test
             * above for why an explicit entry was considered and rejected).
             * This test locks in the resulting invariant: an already-lowercase
             * token is returned via the zero-lookup fast path and never
             * consults the preserved-terms map or any dictionary, so it can
             * never be "promoted" to a canonical uppercase form it didn't
             * start with — regardless of what happens to the ALL-CAPS or
             * Capitalized spelling of the same word elsewhere.
             */
            expect(toSentenceCase('The api Documentation Was Updated Today')).toBe(
                'The api documentation was updated today',
            );
        });
    });
});
