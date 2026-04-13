import { describe, expect, test } from 'vitest';
import { z } from 'zod/v4';

import { parseObject, ParseObjectError } from './parse-object.js';

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
        test('parses valid JSON object', () => {
            // Given -- a valid JSON string matching the schema
            const text = validArticleJson;

            // Then -- the parsed object matches the expected article
            const result = parseObject(text, articleSchema);
            expect(result).toEqual(validArticle);
        });

        test('extracts JSON object from surrounding prose', () => {
            // Given -- JSON embedded in surrounding text
            const text = `Here's the article: ${validArticleJson} - end of article`;

            // Then -- the JSON is extracted and parsed
            const result = parseObject(text, articleSchema);
            expect(result).toEqual(validArticle);
        });

        test('parses JSON from markdown code block', () => {
            // Given -- JSON inside a markdown code block
            const text = `\`\`\`json\n${validArticleJson}\n\`\`\``;

            // Then -- the JSON is extracted from the code block and parsed
            const result = parseObject(text, articleSchema);
            expect(result).toEqual(validArticle);
        });

        test('handles newlines in JSON values', () => {
            // Given -- JSON with escaped newlines in string values
            const text = `{
                "content": "Test\\ncontent\\nwith\\nnewlines",
                "tags": ["test", "ai"],
                "title": "Test\\nArticle"
            }`;

            // Then -- newlines in values are correctly parsed
            const result = parseObject(text, articleSchema);
            expect(result).toEqual({
                content: 'Test\ncontent\nwith\nnewlines',
                tags: ['test', 'ai'],
                title: 'Test\nArticle',
            });
        });

        test('handles escaped characters in JSON', () => {
            // Given -- JSON with various escaped characters
            const text = String.raw`{"content": "Test\ncontent\twith\r\nescapes", "tags": ["test\u0020ai", "escaped\"quotes\""], "title": "Test\\Article"}`;

            // Then -- all escaped characters are correctly parsed
            const result = parseObject(text, articleSchema);
            expect(result).toEqual({
                content: 'Test\ncontent\twith\r\nescapes',
                tags: ['test ai', 'escaped"quotes"'],
                title: 'Test\\Article',
            });
        });
    });

    describe('array parsing', () => {
        test('parses JSON array', () => {
            // Given -- a JSON array of strings
            const text = '["test", "ai", "content"]';
            const schema = z.array(z.string());

            // Then -- the array is correctly parsed
            const result = parseObject(text, schema);
            expect(result).toEqual(['test', 'ai', 'content']);
        });

        test('parses array of objects from markdown code block', () => {
            // Given -- a JSON array inside a markdown code block
            const text = `\`\`\`json\n[${validArticleJson}]\n\`\`\``;
            const schema = z.array(articleSchema);

            // Then -- the array of objects is correctly parsed
            const result = parseObject(text, schema);
            expect(result).toEqual([validArticle]);
        });
    });

    describe('primitive parsing', () => {
        test('parses string value', () => {
            // Given -- a JSON string value
            const text = '"test string"';

            // Then -- the string is parsed correctly
            const result = parseObject(text, z.string());
            expect(result).toBe('test string');
        });

        test('parses number value', () => {
            // Given -- a JSON number value
            const text = '42';

            // Then -- the number is parsed correctly
            const result = parseObject(text, z.number());
            expect(result).toBe(42);
        });

        test('parses boolean value', () => {
            // Given -- a JSON boolean value
            const text = 'true';

            // Then -- the boolean is parsed correctly
            const result = parseObject(text, z.boolean());
            expect(result).toBe(true);
        });

        test('parses null value', () => {
            // Given -- a JSON null value
            const text = 'null';

            // Then -- null is returned
            const result = parseObject(text, z.null());
            expect(result).toBeNull();
        });
    });

    describe('error handling', () => {
        test('throws ParseObjectError for invalid JSON', () => {
            // Given -- invalid JSON text
            const text = '{invalid json}';

            // Then -- ParseObjectError is thrown
            expect(() => parseObject(text, articleSchema)).toThrow(ParseObjectError);
        });

        test('throws ParseObjectError when schema validation fails', () => {
            // Given -- valid JSON that does not match the schema (title is number)
            const text = JSON.stringify({
                content: 'Test',
                tags: ['test'],
                title: 123,
            });

            // Then -- ParseObjectError is thrown
            expect(() => parseObject(text, articleSchema)).toThrow(ParseObjectError);
        });

        test('throws ParseObjectError when no object found', () => {
            // Given -- text with no JSON object
            const text = 'No JSON object here';

            // Then -- ParseObjectError is thrown
            expect(() => parseObject(text, articleSchema)).toThrow(ParseObjectError);
        });

        test('throws ParseObjectError when no array found', () => {
            // Given -- text with no JSON array
            const text = 'No array here';
            const schema = z.array(z.string());

            // Then -- ParseObjectError is thrown
            expect(() => parseObject(text, schema)).toThrow(ParseObjectError);
        });

        test('throws ParseObjectError for unsupported schema type', () => {
            // Given -- an unsupported schema type (date)
            const text = 'test';
            const schema = z.date();

            // Then -- ParseObjectError is thrown
            expect(() => parseObject(text, schema)).toThrow(ParseObjectError);
        });

        test('throws ParseObjectError for union when no object or array found', () => {
            // Given -- plain text with no JSON for a union schema
            const text = 'just plain text';
            const schema = z.union([
                z.object({ type: z.literal('a') }),
                z.object({ type: z.literal('b') }),
            ]);

            // Then -- ParseObjectError is thrown
            expect(() => parseObject(text, schema)).toThrow(ParseObjectError);
        });

        test('includes original text in error', () => {
            // Given -- invalid JSON text
            const text = '{invalid json}';

            // Then -- the error includes the original text
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
        test('parses complex nested JSON with escaped quotes', () => {
            // Given -- a complex nested schema and JSON with escaped quotes
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

            // Then -- the complex JSON is correctly parsed
            const result = parseObject(text, schema);
            expect(result.category).toBe('sports');
            expect(result.countries).toEqual(['us']);
            expect(result.perspectives[0]?.digest).toContain('"Big 3" experiment');
            expect(result.synopsis).toBe('A major trade occurred.');
        });

        test('handles text with multiple whitespace variations', () => {
            // Given -- JSON surrounded by various whitespace
            const text = `Here's the\n\n  article:   \n\n${validArticleJson}\n\n`;

            // Then -- the JSON is extracted and parsed correctly
            const result = parseObject(text, articleSchema);
            expect(result).toEqual(validArticle);
        });

        test('selects largest valid JSON when multiple structures present', () => {
            // Given -- text with two JSON objects, one smaller than the other
            const smallJson = '{"title": "Small"}';
            const text = `First: ${smallJson}, Second: ${validArticleJson}`;

            // Then -- the largest valid JSON matching the schema is selected
            const result = parseObject(text, articleSchema);
            expect(result).toEqual(validArticle);
        });
    });

    describe('union types', () => {
        test('parses z.union - variant A', () => {
            // Given -- a union schema and JSON matching variant A
            const schema = z.union([
                z.object({ type: z.literal('a'), value: z.string() }),
                z.object({ type: z.literal('b'), count: z.number() }),
            ]);
            const text = '{"type": "a", "value": "hello"}';

            // Then -- variant A is correctly parsed
            expect(parseObject(text, schema)).toEqual({ type: 'a', value: 'hello' });
        });

        test('parses z.union - variant B', () => {
            // Given -- a union schema and JSON matching variant B
            const schema = z.union([
                z.object({ type: z.literal('a'), value: z.string() }),
                z.object({ type: z.literal('b'), count: z.number() }),
            ]);
            const text = '{"type": "b", "count": 42}';

            // Then -- variant B is correctly parsed
            expect(parseObject(text, schema)).toEqual({ type: 'b', count: 42 });
        });

        test('parses z.discriminatedUnion', () => {
            // Given -- a discriminated union schema and matching JSON in code block
            const schema = z.discriminatedUnion('action', [
                z.object({ action: z.literal('join'), eventId: z.string() }),
                z.object({ action: z.literal('create'), name: z.string() }),
            ]);
            const text = '```json\n{"action": "create", "name": "Test"}\n```';

            // Then -- the discriminated union is correctly parsed
            expect(parseObject(text, schema)).toEqual({ action: 'create', name: 'Test' });
        });

        test('parses discriminated union from surrounding prose', () => {
            // Given -- a discriminated union schema and JSON in surrounding text
            const schema = z.discriminatedUnion('action', [
                z.object({ action: z.literal('join'), eventId: z.string() }),
                z.object({ action: z.literal('create'), name: z.string() }),
            ]);
            const text = 'Here is the result: {"action": "join", "eventId": "evt-123"} - done';

            // Then -- the JSON is extracted and parsed
            expect(parseObject(text, schema)).toEqual({ action: 'join', eventId: 'evt-123' });
        });

        test('parses union of arrays', () => {
            // Given -- a union of array types and a matching string array
            const schema = z.union([z.array(z.string()), z.array(z.number())]);
            const text = '["a", "b", "c"]';

            // Then -- the string array variant is parsed
            expect(parseObject(text, schema)).toEqual(['a', 'b', 'c']);
        });

        test('throws when union variant does not match', () => {
            // Given -- a discriminated union schema and JSON with no matching variant
            const schema = z.discriminatedUnion('action', [
                z.object({ action: z.literal('join'), eventId: z.string() }),
                z.object({ action: z.literal('create'), name: z.string() }),
            ]);
            const text = '{"action": "delete", "id": "123"}';

            // Then -- ParseObjectError is thrown
            expect(() => parseObject(text, schema)).toThrow(ParseObjectError);
        });
    });

    describe('wrapper types', () => {
        test('parses z.optional wrapping an object', () => {
            // Given -- an optional object schema and valid JSON
            const schema = z.object({ name: z.string() }).optional();
            const text = '{"name": "test"}';

            // Then -- the object is parsed through the optional wrapper
            expect(parseObject(text, schema)).toEqual({ name: 'test' });
        });

        test('parses z.nullable wrapping an object', () => {
            // Given -- a nullable object schema and valid JSON
            const schema = z.object({ name: z.string() }).nullable();
            const text = '{"name": "test"}';

            // Then -- the object is parsed through the nullable wrapper
            expect(parseObject(text, schema)).toEqual({ name: 'test' });
        });

        test('parses z.default wrapping an object', () => {
            // Given -- an object schema with default and valid JSON
            const schema = z.object({ name: z.string() }).default({ name: 'default' });
            const text = '{"name": "custom"}';

            // Then -- the provided value is used instead of the default
            expect(parseObject(text, schema)).toEqual({ name: 'custom' });
        });

        test('parses schema with .transform()', () => {
            // Given -- a schema with a transform that adds a field
            const schema = z.object({ value: z.string() }).transform((obj) => ({
                ...obj,
                transformed: true,
            }));
            const text = '{"value": "test"}';

            // Then -- the transform is applied to the parsed object
            const result = parseObject(text, schema);
            expect(result).toEqual({ value: 'test', transformed: true });
        });

        test('parses schema with .refine()', () => {
            // Given -- a schema with a refinement constraint
            const schema = z.object({ value: z.number() }).refine((obj) => obj.value > 0, {
                message: 'Value must be positive',
            });
            const text = '{"value": 42}';

            // Then -- the refinement passes and object is parsed
            expect(parseObject(text, schema)).toEqual({ value: 42 });
        });

        test('parses deeply nested wrapper types', () => {
            // Given -- a schema with multiple nested wrappers (optional, nullable, default)
            const schema = z
                .object({ name: z.string() })
                .optional()
                .nullable()
                .default({ name: 'default' });
            const text = '{"name": "nested"}';

            // Then -- the object is parsed through all wrapper layers
            expect(parseObject(text, schema)).toEqual({ name: 'nested' });
        });

        test('parses optional array', () => {
            // Given -- an optional array schema and valid JSON array
            const schema = z.array(z.string()).optional();
            const text = '["a", "b", "c"]';

            // Then -- the array is parsed through the optional wrapper
            expect(parseObject(text, schema)).toEqual(['a', 'b', 'c']);
        });
    });
});
