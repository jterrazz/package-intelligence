import { expect, test } from 'vitest';
import { z } from 'zod/v4';

import { createSchemaPrompt, parseObject, ParseObjectError, parseText } from '../../src/index.js';

test('parses structured object from simulated AI response', () => {
    // Given — a zod schema and a simulated AI response containing JSON embedded in prose
    const schema = z.object({
        title: z.string(),
        tags: z.array(z.string()),
    });

    const prompt = createSchemaPrompt(schema);
    expect(prompt).toContain('JSON');

    const aiResponse = `Sure, here is the result: {"title": "TypeScript Guide", "tags": ["typescript", "programming", "guide"]} Hope that helps!`;

    // Then — parseObject extracts and validates the JSON against the schema
    const result = parseObject(aiResponse, schema);
    expect(result).toEqual({
        title: 'TypeScript Guide',
        tags: ['typescript', 'programming', 'guide'],
    });
});

test('parses array from markdown code block', () => {
    // Given — a schema expecting an array and a simulated AI response with a markdown code block
    const schema = z.array(z.object({ name: z.string() }));

    const aiResponse = `Here are the results:

\`\`\`json
[{"name": "Alice"}, {"name": "Bob"}, {"name": "Charlie"}]
\`\`\`

Let me know if you need more.`;

    // Then — parseObject extracts the array from the code block and validates it
    const result = parseObject(aiResponse, schema);
    expect(result).toEqual([{ name: 'Alice' }, { name: 'Bob' }, { name: 'Charlie' }]);
});

test('sanitizes text before parsing', () => {
    // Given — AI output with BOM, smart quotes, and invisible characters that needs sanitizing
    const dirtyText = `\uFEFF\u201CHello world\u201D \u2018test\u2019 a \u2026 result`;

    const cleaned = parseText(dirtyText);

    // Then — parseText removes BOM, normalizes smart quotes, and replaces ellipsis
    expect(cleaned).toBe(`"Hello world" 'test' a ... result`);

    // Given — the cleaned text embedded in a JSON response with proper escaping
    const schema = z.object({ message: z.string() });
    const aiResponse = JSON.stringify({ message: cleaned });

    // Then — parseObject successfully parses the sanitized text
    const result = parseObject(aiResponse, schema);
    expect(result.message).toBe(cleaned);
});

test('handles AI response with surrounding prose', () => {
    // Given — a schema and a simulated AI response with JSON surrounded by prose
    const schema = z.object({
        score: z.number(),
        reason: z.string(),
    });

    const aiResponse = `Based on my analysis, here is the result: {"score": 85, "reason": "good performance"} I hope this helps!`;

    // Then — parseObject extracts the JSON from surrounding prose and validates it
    const result = parseObject(aiResponse, schema);
    expect(result).toEqual({
        score: 85,
        reason: 'good performance',
    });
});

test('rejects invalid JSON with ParseObjectError', () => {
    // Given — a schema and a simulated AI response with no valid JSON
    const schema = z.object({
        name: z.string(),
    });

    const aiResponse = `I'm sorry, I cannot provide that information in a structured format right now.`;

    // Then — parseObject throws a ParseObjectError
    expect(() => parseObject(aiResponse, schema)).toThrow(ParseObjectError);
});
