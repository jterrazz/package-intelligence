import { describe, expect, it } from '@jterrazz/test';
import { z } from 'zod/v4';

import { AIResponseParser } from '../ai-response-parser.js';
import { AIResponseParserError } from '../ai-response-parser-error.js';

// Test data
const testSchema = z.object({
    content: z.string(),
    tags: z.array(z.string()),
    title: z.string(),
});

const validJson = {
    content: 'Test content',
    tags: ['test', 'ai'],
    title: 'Test Article',
};

const validJsonString = JSON.stringify(validJson);

describe('AIResponseParser', () => {
    describe('parse', () => {
        it('should parse valid JSON object', () => {
            // Given - a valid JSON object string and parser
            const text = validJsonString;
            const parser = new AIResponseParser(testSchema);

            // When - parsing the string
            const result = parser.parse(text);

            // Then - it should return the parsed object
            expect(result).toEqual(validJson);
        });

        it('should parse JSON object with surrounding text', () => {
            // Given - a JSON object string with surrounding text and parser
            const text = `Here's the article: ${validJsonString} - end of article`;
            const parser = new AIResponseParser(testSchema);

            // When - parsing the string
            const result = parser.parse(text);

            // Then - it should return the parsed object
            expect(result).toEqual(validJson);
        });

        it('should parse array response', () => {
            // Given - a JSON array string and array parser
            const arraySchema = z.array(z.string());
            const text = '["test", "ai", "content"]';
            const parser = new AIResponseParser(arraySchema);

            // When - parsing the string
            const result = parser.parse(text);

            // Then - it should return the parsed array
            expect(result).toEqual(['test', 'ai', 'content']);
        });

        it('should parse primitive string value', () => {
            // Given - a JSON string value and string parser
            const text = '"test string"';
            const parser = new AIResponseParser(z.string());

            // When - parsing the string
            const result = parser.parse(text);

            // Then - it should return the parsed string
            expect(result).toBe('test string');
        });

        it('should parse primitive number value', () => {
            // Given - a JSON number value and number parser
            const text = '42';
            const parser = new AIResponseParser(z.number());

            // When - parsing the string
            const result = parser.parse(text);

            // Then - it should return the parsed number
            expect(result).toBe(42);
        });

        it('should parse primitive boolean value', () => {
            // Given - a JSON boolean value and boolean parser
            const text = 'true';
            const parser = new AIResponseParser(z.boolean());

            // When - parsing the string
            const result = parser.parse(text);

            // Then - it should return the parsed boolean
            expect(result).toBe(true);
        });

        it('should parse primitive null value', () => {
            // Given - a JSON null value and null parser
            const text = 'null';
            const parser = new AIResponseParser(z.null());

            // When - parsing the string
            const result = parser.parse(text);

            // Then - it should return the parsed null
            expect(result).toBeNull();
        });

        it('should throw ResponseParsingError when JSON is invalid', () => {
            // Given - an invalid JSON string and parser
            const text = '{invalid json}';
            const parser = new AIResponseParser(testSchema);

            // When/Then - parsing the string should throw a ResponseParsingError
            expect(() => parser.parse(text)).toThrow(AIResponseParserError);
        });

        it('should throw ResponseParsingError when schema validation fails', () => {
            // Given - an invalid JSON object and parser
            const invalidJson = {
                // Should be string
                content: 'Test content',
                tags: ['test', 'ai'],
                title: 123,
            };
            const text = JSON.stringify(invalidJson);
            const parser = new AIResponseParser(testSchema);

            // When/Then - parsing the string should throw a ResponseParsingError
            expect(() => parser.parse(text)).toThrow(AIResponseParserError);
        });

        it('should throw ResponseParsingError when no object found in text', () => {
            // Given - a text without a JSON object and parser
            const text = 'No JSON object here';
            const parser = new AIResponseParser(testSchema);

            // When/Then - parsing the string should throw a ResponseParsingError
            expect(() => parser.parse(text)).toThrow(AIResponseParserError);
        });

        it('should throw ResponseParsingError when no array found in text', () => {
            // Given - a text without a JSON array and array parser
            const text = 'No array here';
            const arraySchema = z.array(z.string());
            const parser = new AIResponseParser(arraySchema);

            // When/Then - parsing the string should throw a ResponseParsingError
            expect(() => parser.parse(text)).toThrow(AIResponseParserError);
        });

        it('should throw ResponseParsingError for unsupported schema type', () => {
            // Given - a text with an unsupported schema type and parser
            const text = 'test';
            const unsupportedSchema = z.union([z.string(), z.number()]);
            const parser = new AIResponseParser(unsupportedSchema);

            // When/Then - parsing the string should throw a ResponseParsingError
            expect(() => parser.parse(text)).toThrow(AIResponseParserError);
        });

        it('should include original text in error when parsing fails', () => {
            // Given - an invalid JSON string and parser
            const text = '{invalid json}';
            const parser = new AIResponseParser(testSchema);

            // When - parsing the string
            try {
                parser.parse(text);
                throw new Error('Should have thrown an error');
            } catch (error) {
                // Then - the error should include the original text
                expect(error).toBeInstanceOf(AIResponseParserError);
                expect((error as AIResponseParserError).text).toBe(text);
            }
        });

        it('should handle text with newlines in JSON object', () => {
            // Given - a JSON object with newlines and parser
            const textWithNewlines = `{
                "content": "Test\ncontent\nwith\nnewlines",
                "tags": ["test", "ai"],
                "title": "Test\nArticle"
            }`;
            const parser = new AIResponseParser(testSchema);

            // When - parsing the string
            const result = parser.parse(textWithNewlines);

            // Then - it should return the parsed object
            expect(result).toEqual({
                content: 'Test content with newlines',
                tags: ['test', 'ai'],
                title: 'Test Article',
            });
        });

        it('should handle text with newlines in surrounding text', () => {
            // Given - a text with newlines around the JSON object and parser
            const textWithNewlines = `Here's the\narticle:\n${validJsonString}\n- end of\narticle`;
            const parser = new AIResponseParser(testSchema);

            // When - parsing the string
            const result = parser.parse(textWithNewlines);

            // Then - it should return the parsed object
            expect(result).toEqual(validJson);
        });

        it('should handle text with multiple consecutive newlines and spaces', () => {
            // Given - a text with multiple consecutive newlines and spaces and parser
            const textWithNewlines = `Here's the\n\n  article:   \n\n${validJsonString}\n\n`;
            const parser = new AIResponseParser(testSchema);

            // When - parsing the string
            const result = parser.parse(textWithNewlines);

            // Then - it should return the parsed object
            expect(result).toEqual(validJson);
        });

        it('should handle escaped characters in JSON', () => {
            // Given - a JSON string with escaped characters and parser
            const text =
                '{"content": "Test\\ncontent\\twith\\r\\nescapes", "tags": ["test\\u0020ai", "escaped\\"quotes\\""], "title": "Test\\\\Article"}';
            const parser = new AIResponseParser(testSchema);

            // When - parsing the string
            const result = parser.parse(text);

            // Then - it should return the parsed object
            expect(result).toEqual({
                content: 'Test\ncontent\twith\r\nescapes',
                tags: ['test ai', 'escaped"quotes"'],
                title: 'Test\\Article',
            });
        });

        it('should handle escaped characters in markdown code blocks', () => {
            // Given - a markdown code block with escaped characters and parser
            const text =
                '```json\n{"content": "Test\\nContent", "tags": ["test\\u0020ai"], "title": "Test\\\\Title"}\n```';
            const parser = new AIResponseParser(testSchema);

            // When - parsing the string
            const result = parser.parse(text);

            // Then - it should return the parsed object
            expect(result).toEqual({
                content: 'Test\nContent',
                tags: ['test ai'],
                title: 'Test\\Title',
            });
        });

        it('should handle escaped characters in markdown code blocks', () => {
            // Given - a markdown code block with escaped characters and array parser
            const text =
                '```json\n [\n{"content": "Test\\nContent", "tags": ["test\\u0020ai"], "title": "Test\\\\Title"}\n]\n```';
            const arraySchema = z.array(testSchema);
            const parser = new AIResponseParser(arraySchema);

            // When - parsing the string
            const result = parser.parse(text);

            // Then - it should return the parsed array
            expect(result).toEqual([
                {
                    content: 'Test\nContent',
                    tags: ['test ai'],
                    title: 'Test\\Title',
                },
            ]);
        });
    });
});
