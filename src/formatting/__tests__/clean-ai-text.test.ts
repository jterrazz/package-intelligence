import { describe, expect, test } from 'vitest';

import { cleanAiText } from '../clean-ai-text.js';
import type { CleanAiTextOptions } from '../clean-ai-text.js';

type Case = { expected: string; input: string; name: string; options?: CleanAiTextOptions };

const CASES: Case[] = [
    {
        expected: 'Text here',
        input: 'Text (oaicite:12){index=34} here',
        name: 'removes a citation marker of several digits',
    },
    {
        expected: 'Text, here',
        input: 'Text(oaicite:0){index=0}, here',
        name: 'removes a citation marker glued to its word',
    },
    {
        expected: 'hello world',
        input: 'hello\u1680world',
        name: 'turns an ogham space mark into a space',
    },
    { expected: '', input: '', name: 'returns empty string for empty input' },
    {
        expected: 'hello world',
        input: '  hello world  ',
        name: 'returns trimmed text for simple input',
    },
    { expected: 'hello\nworld', input: 'hello\nworld', name: 'preserves newlines' },
    { expected: 'hello', input: '\uFEFFhello', name: 'removes BOM character at start' },
    {
        expected: 'helloworld',
        input: 'hello\uFEFFworld',
        name: 'removes BOM in middle of text (via invisible char removal)',
    },
    { expected: 'hello\nworld', input: 'hello\r\nworld', name: 'converts CRLF to LF' },
    { expected: 'hello\nworld', input: 'hello\rworld', name: 'converts standalone CR to LF' },
    {
        expected: 'Some text more text',
        input: 'Some text (oaicite:0){index=0} more text',
        name: 'removes oaicite markers',
    },
    {
        expected: 'Text and here',
        input: 'Text (oaicite:1){index=1} and (oaicite:2){index=2} here',
        name: 'removes multiple citation markers',
    },
    { expected: 'helloworld', input: 'hello\u200Bworld', name: 'removes zero-width space' },
    { expected: 'helloworld', input: 'hello\u200Cworld', name: 'removes zero-width non-joiner' },
    { expected: 'helloworld', input: 'hello\u00ADworld', name: 'removes soft hyphen' },
    { expected: 'helloworld', input: 'hello\u200E\u200Fworld', name: 'removes direction marks' },
    { expected: 'helloworld', input: 'hello\u2060world', name: 'removes word joiner' },
    { expected: 'helloworld', input: 'hello\u0000world', name: 'removes null character' },
    { expected: 'helloworld', input: 'hello\u0007world', name: 'removes bell character' },
    { expected: 'helloworld', input: 'hello\u007Fworld', name: 'removes delete character' },
    { expected: 'hello\tworld\n!', input: 'hello\tworld\n!', name: 'preserves tab and newline' },
    {
        expected: 'hello, world',
        input: 'hello — world',
        name: 'converts em dash with spaces to comma',
    },
    {
        expected: 'hello, world',
        input: 'hello – world',
        name: 'converts en dash with spaces to comma',
    },
    {
        expected: 'hello, world',
        input: 'hello ― world',
        name: 'converts horizontal bar with spaces to comma',
    },
    {
        expected: 'hello, world',
        input: 'hello ‒ world',
        name: 'converts figure dash with spaces to comma',
    },
    {
        expected: 'disparaître, ne laissant',
        input: 'disparaître—ne laissant',
        name: 'converts em dash without spaces to comma',
    },
    {
        expected: 'hello — world',
        input: 'hello — world',
        name: 'can be disabled via options',
        options: { normalizeEmDashesToCommas: false },
    },
    {
        expected: 'word—word',
        input: 'word—word',
        name: 'preserves em dash when disabled (no spaces)',
        options: { normalizeEmDashesToCommas: false },
    },
    {
        expected: 'hello world',
        input: 'hello\u00A0world',
        name: 'converts non-breaking space to regular space',
    },
    {
        expected: 'hello world',
        input: 'hello\u2003world',
        name: 'converts em space to regular space',
    },
    {
        expected: 'hello world',
        input: 'hello\u202Fworld',
        name: 'converts narrow no-break space to regular space',
    },
    {
        expected: 'hello world',
        input: 'hello\u3000world',
        name: 'converts ideographic space to regular space',
    },
    { expected: "it's", input: 'it\u2018s', name: 'converts left single quote to straight quote' },
    { expected: "it's", input: 'it\u2019s', name: 'converts right single quote to straight quote' },
    {
        expected: '"Hello"',
        input: '\u201CHello\u201D',
        name: 'converts left double quote to straight quote',
    },
    { expected: 'word, word', input: 'word\u2014word', name: 'converts em dash to comma' },
    { expected: '2020, 2021', input: '2020\u20132021', name: 'converts en dash to comma' },
    { expected: 'wait...', input: 'wait\u2026', name: 'converts ellipsis to three dots' },
    { expected: '- item', input: '\u2022 item', name: 'converts bullet point to hyphen' },
    {
        expected: 'hello world',
        input: 'hello    world',
        name: 'collapses multiple spaces to single space',
    },
    {
        expected: 'hello world',
        input: '   hello world   ',
        name: 'trims leading and trailing spaces',
    },
    {
        expected: 'hello    world',
        input: 'hello    world',
        name: 'can be disabled via options',
        options: { collapseSpaces: false },
    },
    { expected: 'ABC', input: '\uFF21\uFF22\uFF23', name: 'normalizes fullwidth characters' },
    { expected: 'file', input: '\uFB01le', name: 'normalizes ligatures' },
    {
        expected: "Hello's world, with spaces",
        input: '\uFEFF  Hello\u2019s world (oaicite:0){index=0} \u2014 with\u00A0spaces  ',
        name: 'handles AI-generated text with multiple issues',
    },
    {
        expected: '"This is a quote", Author',
        input: '\u201CThis is a quote\u201D \u2014 Author',
        name: 'handles markdown with smart quotes and dashes',
    },
];

describe('cleanAiText', () => {
    test.each(CASES)('$name', ({ expected, input, options }) => {
        // Given - one row of the table: the text an AI wrote, and the options it is cleaned with
        const cleaned = cleanAiText(input, options);

        // Then - the text the row expects
        expect(cleaned).toBe(expected);
    });
});
