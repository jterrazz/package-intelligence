import { describe, expect, it } from 'vitest';
import { z } from 'zod/v4';

import { parseObject, ParseObjectError } from '../parse-object.js';

const articleSchema = z.object({
    content: z.string(),
    tags: z.array(z.string()),
    title: z.string(),
});

const validArticle = {
    content: 'Test content',
    tags: ['test', 'ai'],
    title: 'Test Article',
};

const validArticleJson = JSON.stringify(validArticle);

describe('parseObject', () => {
    describe('object parsing', () => {
        it('parses valid JSON object', () => {
            const text = validArticleJson;
            const result = parseObject(text, articleSchema);
            expect(result).toEqual(validArticle);
        });

        it('extracts JSON object from surrounding prose', () => {
            const text = `Here's the article: ${validArticleJson} - end of article`;
            const result = parseObject(text, articleSchema);
            expect(result).toEqual(validArticle);
        });

        it('parses JSON from markdown code block', () => {
            const text = `\`\`\`json\n${validArticleJson}\n\`\`\``;
            const result = parseObject(text, articleSchema);
            expect(result).toEqual(validArticle);
        });

        it('handles newlines in JSON values', () => {
            const text = `{
                "content": "Test\\ncontent\\nwith\\nnewlines",
                "tags": ["test", "ai"],
                "title": "Test\\nArticle"
            }`;
            const result = parseObject(text, articleSchema);
            expect(result).toEqual({
                content: 'Test\ncontent\nwith\nnewlines',
                tags: ['test', 'ai'],
                title: 'Test\nArticle',
            });
        });

        it('handles escaped characters in JSON', () => {
            const text =
                '{"content": "Test\\ncontent\\twith\\r\\nescapes", "tags": ["test\\u0020ai", "escaped\\"quotes\\""], "title": "Test\\\\Article"}';
            const result = parseObject(text, articleSchema);
            expect(result).toEqual({
                content: 'Test\ncontent\twith\r\nescapes',
                tags: ['test ai', 'escaped"quotes"'],
                title: 'Test\\Article',
            });
        });
    });

    describe('array parsing', () => {
        it('parses JSON array', () => {
            const text = '["test", "ai", "content"]';
            const schema = z.array(z.string());
            const result = parseObject(text, schema);
            expect(result).toEqual(['test', 'ai', 'content']);
        });

        it('parses array of objects from markdown code block', () => {
            const text = `\`\`\`json\n[${validArticleJson}]\n\`\`\``;
            const schema = z.array(articleSchema);
            const result = parseObject(text, schema);
            expect(result).toEqual([validArticle]);
        });
    });

    describe('primitive parsing', () => {
        it('parses string value', () => {
            const text = '"test string"';
            const result = parseObject(text, z.string());
            expect(result).toBe('test string');
        });

        it('parses number value', () => {
            const text = '42';
            const result = parseObject(text, z.number());
            expect(result).toBe(42);
        });

        it('parses boolean value', () => {
            const text = 'true';
            const result = parseObject(text, z.boolean());
            expect(result).toBe(true);
        });

        it('parses null value', () => {
            const text = 'null';
            const result = parseObject(text, z.null());
            expect(result).toBeNull();
        });
    });

    describe('error handling', () => {
        it('throws ParseObjectError for invalid JSON', () => {
            const text = '{invalid json}';
            expect(() => parseObject(text, articleSchema)).toThrow(ParseObjectError);
        });

        it('throws ParseObjectError when schema validation fails', () => {
            const text = JSON.stringify({
                content: 'Test',
                tags: ['test'],
                title: 123,
            });
            expect(() => parseObject(text, articleSchema)).toThrow(ParseObjectError);
        });

        it('throws ParseObjectError when no object found', () => {
            const text = 'No JSON object here';
            expect(() => parseObject(text, articleSchema)).toThrow(ParseObjectError);
        });

        it('throws ParseObjectError when no array found', () => {
            const text = 'No array here';
            const schema = z.array(z.string());
            expect(() => parseObject(text, schema)).toThrow(ParseObjectError);
        });

        it('throws ParseObjectError for unsupported schema type', () => {
            const text = 'test';
            const schema = z.union([z.string(), z.number()]);
            expect(() => parseObject(text, schema)).toThrow(ParseObjectError);
        });

        it('includes original text in error', () => {
            const text = '{invalid json}';
            try {
                parseObject(text, articleSchema);
                throw new Error('Should have thrown');
            } catch (error) {
                expect(error).toBeInstanceOf(ParseObjectError);
                expect((error as ParseObjectError).text).toBe(text);
            }
        });
    });

    describe('complex scenarios', () => {
        it('parses complex nested JSON with escaped quotes', () => {
            const schema = z.object({
                category: z.string(),
                countries: z.array(z.string()),
                perspectives: z.array(
                    z.object({
                        digest: z.string(),
                        tags: z.object({
                            type: z.string(),
                            stance: z.string(),
                        }),
                    }),
                ),
                synopsis: z.string(),
            });

            const text = `\`\`\`json
{
  "category": "sports",
  "countries": ["us"],
  "perspectives": [{
    "digest": "The team's \\"Big 3\\" experiment failed.",
    "tags": { "type": "analysis", "stance": "neutral" }
  }],
  "synopsis": "A major trade occurred."
}
\`\`\``;

            const result = parseObject(text, schema);
            expect(result.category).toBe('sports');
            expect(result.countries).toEqual(['us']);
            expect(result.perspectives[0]?.digest).toContain('"Big 3" experiment');
            expect(result.synopsis).toBe('A major trade occurred.');
        });

        it('handles text with multiple whitespace variations', () => {
            const text = `Here's the\n\n  article:   \n\n${validArticleJson}\n\n`;
            const result = parseObject(text, articleSchema);
            expect(result).toEqual(validArticle);
        });

        it('selects largest valid JSON when multiple structures present', () => {
            const smallJson = '{"title": "Small"}';
            const text = `First: ${smallJson}, Second: ${validArticleJson}`;
            const result = parseObject(text, articleSchema);
            expect(result).toEqual(validArticle);
        });
    });
});
