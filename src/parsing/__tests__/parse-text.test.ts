import { describe, expect, it } from 'vitest';

import { parseText } from '../parse-text.js';

describe('parseText', () => {
    describe('empty and basic input', () => {
        it('returns empty string for empty input', () => {
            expect(parseText('')).toBe('');
        });

        it('returns trimmed text for simple input', () => {
            expect(parseText('  hello world  ')).toBe('hello world');
        });

        it('preserves newlines', () => {
            expect(parseText('hello\nworld')).toBe('hello\nworld');
        });
    });

    describe('BOM handling', () => {
        it('removes BOM character at start', () => {
            expect(parseText('\uFEFFhello')).toBe('hello');
        });

        it('removes BOM in middle of text (via invisible char removal)', () => {
            expect(parseText('hello\uFEFFworld')).toBe('helloworld');
        });
    });

    describe('line ending normalization', () => {
        it('converts CRLF to LF', () => {
            expect(parseText('hello\r\nworld')).toBe('hello\nworld');
        });

        it('converts standalone CR to LF', () => {
            expect(parseText('hello\rworld')).toBe('hello\nworld');
        });
    });

    describe('AI citation removal', () => {
        it('removes oaicite markers', () => {
            expect(parseText('Some text (oaicite:0){index=0} more text')).toBe(
                'Some text more text',
            );
        });

        it('removes multiple citation markers', () => {
            expect(parseText('Text (oaicite:1){index=1} and (oaicite:2){index=2} here')).toBe(
                'Text and here',
            );
        });
    });

    describe('invisible character removal', () => {
        it('removes zero-width space', () => {
            expect(parseText('hello\u200Bworld')).toBe('helloworld');
        });

        it('removes zero-width non-joiner', () => {
            expect(parseText('hello\u200Cworld')).toBe('helloworld');
        });

        it('removes soft hyphen', () => {
            expect(parseText('hello\u00ADworld')).toBe('helloworld');
        });

        it('removes direction marks', () => {
            expect(parseText('hello\u200E\u200Fworld')).toBe('helloworld');
        });

        it('removes word joiner', () => {
            expect(parseText('hello\u2060world')).toBe('helloworld');
        });
    });

    describe('ASCII control character removal', () => {
        it('removes null character', () => {
            expect(parseText('hello\x00world')).toBe('helloworld');
        });

        it('removes bell character', () => {
            expect(parseText('hello\x07world')).toBe('helloworld');
        });

        it('removes delete character', () => {
            expect(parseText('hello\x7Fworld')).toBe('helloworld');
        });

        it('preserves tab and newline', () => {
            expect(parseText('hello\tworld\n!')).toBe('hello\tworld\n!');
        });
    });

    describe('em/en dash normalization', () => {
        it('converts em dash with spaces to comma', () => {
            expect(parseText('hello — world')).toBe('hello, world');
        });

        it('converts en dash with spaces to comma', () => {
            expect(parseText('hello – world')).toBe('hello, world');
        });

        it('converts horizontal bar with spaces to comma', () => {
            expect(parseText('hello ― world')).toBe('hello, world');
        });

        it('converts figure dash with spaces to comma', () => {
            expect(parseText('hello ‒ world')).toBe('hello, world');
        });

        it('can be disabled via options', () => {
            expect(parseText('hello — world', { normalizeEmDashesToCommas: false })).toBe(
                'hello - world',
            );
        });
    });

    describe('space-like character normalization', () => {
        it('converts non-breaking space to regular space', () => {
            expect(parseText('hello\u00A0world')).toBe('hello world');
        });

        it('converts em space to regular space', () => {
            expect(parseText('hello\u2003world')).toBe('hello world');
        });

        it('converts narrow no-break space to regular space', () => {
            expect(parseText('hello\u202Fworld')).toBe('hello world');
        });

        it('converts ideographic space to regular space', () => {
            expect(parseText('hello\u3000world')).toBe('hello world');
        });
    });

    describe('typography normalization', () => {
        it('converts left single quote to straight quote', () => {
            expect(parseText('it\u2018s')).toBe("it's");
        });

        it('converts right single quote to straight quote', () => {
            expect(parseText('it\u2019s')).toBe("it's");
        });

        it('converts left double quote to straight quote', () => {
            expect(parseText('\u201CHello\u201D')).toBe('"Hello"');
        });

        it('converts em dash to hyphen', () => {
            expect(parseText('word\u2014word')).toBe('word-word');
        });

        it('converts en dash to hyphen', () => {
            expect(parseText('2020\u20132021')).toBe('2020-2021');
        });

        it('converts ellipsis to three dots', () => {
            expect(parseText('wait\u2026')).toBe('wait...');
        });

        it('converts bullet point to hyphen', () => {
            expect(parseText('\u2022 item')).toBe('- item');
        });
    });

    describe('multiple space collapsing', () => {
        it('collapses multiple spaces to single space', () => {
            expect(parseText('hello    world')).toBe('hello world');
        });

        it('trims leading and trailing spaces', () => {
            expect(parseText('   hello world   ')).toBe('hello world');
        });

        it('can be disabled via options', () => {
            expect(parseText('hello    world', { collapseSpaces: false })).toBe('hello    world');
        });
    });

    describe('NFKC normalization', () => {
        it('normalizes fullwidth characters', () => {
            expect(parseText('\uFF21\uFF22\uFF23')).toBe('ABC');
        });

        it('normalizes ligatures', () => {
            expect(parseText('\uFB01le')).toBe('file');
        });
    });

    describe('combined scenarios', () => {
        it('handles AI-generated text with multiple issues', () => {
            const input =
                '\uFEFF  Hello\u2019s world (oaicite:0){index=0} \u2014 with\u00A0spaces  ';
            expect(parseText(input)).toBe("Hello's world, with spaces");
        });

        it('handles markdown with smart quotes and dashes', () => {
            const input = '\u201CThis is a quote\u201D \u2014 Author';
            expect(parseText(input)).toBe('"This is a quote", Author');
        });
    });
});
