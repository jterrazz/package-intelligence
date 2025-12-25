import { jsonrepair } from 'jsonrepair';
import { z } from 'zod/v4';

/**
 * Error thrown when object parsing fails.
 * Contains the original text for debugging purposes.
 */
export class ParseObjectError extends Error {
    public readonly name = 'ParseObjectError';

    constructor(
        message: string,
        public readonly cause?: unknown,
        public readonly text?: string,
    ) {
        super(message);
    }
}

/**
 * Parses AI-generated text into structured data validated against a Zod schema.
 *
 * Handles common AI response formats:
 * - JSON wrapped in markdown code blocks
 * - JSON embedded in prose text
 * - Malformed JSON (auto-repaired)
 * - Escaped unicode and special characters
 *
 * @param text - The raw AI response text
 * @param schema - A Zod schema to validate and type the result
 * @returns The parsed and validated data
 * @throws {ParseObjectError} When parsing or validation fails
 *
 * @example
 * ```ts
 * const schema = z.object({ title: z.string(), tags: z.array(z.string()) });
 * const result = parseObject(aiResponse, schema);
 * // result is typed as { title: string; tags: string[] }
 * ```
 */
export function parseObject<T>(text: string, schema: z.ZodSchema<T>): T {
    try {
        const jsonString = extractJsonString(text);
        const extracted = extractBySchemaType(jsonString, schema, text);
        const unescaped = unescapeJsonValues(extracted);
        return schema.parse(unescaped);
    } catch (error) {
        if (error instanceof ParseObjectError) {
            throw error;
        }
        if (error instanceof z.ZodError) {
            throw new ParseObjectError('Failed to validate response against schema', error, text);
        }
        throw error;
    }
}

const MARKDOWN_CODE_BLOCK_RE = /```(?:json)?\r?\n([^`]*?)\r?\n```/g;

function convertToPrimitive(value: unknown, schema: z.ZodType): unknown {
    if (schema instanceof z.ZodBoolean) return Boolean(value);
    if (schema instanceof z.ZodNull) return null;
    if (schema instanceof z.ZodNumber) return Number(value);
    if (schema instanceof z.ZodString) return String(value);
    return value;
}

function extractArray(text: string, originalText: string): unknown {
    const start = text.indexOf('[');
    const end = text.lastIndexOf(']');

    if (start === -1 || end === -1) {
        throw new ParseObjectError('No array found in response', undefined, originalText);
    }

    try {
        const raw = text.slice(start, end + 1);
        return JSON.parse(jsonrepair(raw));
    } catch (error) {
        throw new ParseObjectError('Failed to parse array JSON', error, originalText);
    }
}

function extractBySchemaType(text: string, schema: z.ZodType, originalText: string): unknown {
    if (schema instanceof z.ZodArray) {
        return extractArray(text, originalText);
    }

    if (schema instanceof z.ZodObject) {
        return extractObject(text, originalText);
    }

    if (
        schema instanceof z.ZodBoolean ||
        schema instanceof z.ZodNull ||
        schema instanceof z.ZodNumber ||
        schema instanceof z.ZodString
    ) {
        return extractPrimitive(text, schema);
    }

    // Handle union types - extract as object/array and let Zod validate which variant matches
    if (schema instanceof z.ZodUnion || schema instanceof z.ZodDiscriminatedUnion) {
        const objectStart = text.indexOf('{');
        if (objectStart !== -1) {
            return extractObject(text, originalText);
        }
        const arrayStart = text.indexOf('[');
        if (arrayStart !== -1) {
            return extractArray(text, originalText);
        }
        throw new ParseObjectError(
            'No object or array found for union type',
            undefined,
            originalText,
        );
    }

    // Handle wrapper types - unwrap and delegate to inner type
    if (schema instanceof z.ZodOptional || schema instanceof z.ZodNullable) {
        return extractBySchemaType(text, schema.unwrap() as z.ZodType, originalText);
    }

    if (schema instanceof z.ZodDefault) {
        return extractBySchemaType(text, schema.def.innerType as z.ZodType, originalText);
    }

    // Handle .transform() which creates a ZodPipe in Zod v4
    if (schema instanceof z.ZodPipe) {
        return extractBySchemaType(text, schema.def.in as z.ZodType, originalText);
    }

    throw new ParseObjectError('Unsupported schema type', undefined, originalText);
}

function extractJsonFromCodeBlock(block: string): null | string {
    const content = block.replace(/```(?:json)?\r?\n([^`]*?)\r?\n```/, '$1').trim();
    try {
        JSON.parse(content);
        return content;
    } catch {
        return null;
    }
}

function extractJsonString(text: string): string {
    const codeBlocks = text.match(MARKDOWN_CODE_BLOCK_RE);
    if (codeBlocks && codeBlocks.length > 0) {
        const validBlocks = codeBlocks
            .map((block) => extractJsonFromCodeBlock(block))
            .filter((block): block is string => block !== null);

        if (validBlocks.length > 0) {
            return findLongestString(validBlocks);
        }
    }

    const structures = findJsonStructures(text);
    if (structures.length > 0) {
        return findLongestString(structures);
    }

    return text.replace(/\s+/g, ' ').trim();
}

function extractObject(text: string, originalText: string): unknown {
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');

    if (start === -1 || end === -1) {
        throw new ParseObjectError('No object found in response', undefined, originalText);
    }

    try {
        const raw = text.slice(start, end + 1);
        return JSON.parse(jsonrepair(raw));
    } catch (error) {
        throw new ParseObjectError('Failed to parse object JSON', error, originalText);
    }
}

function extractPrimitive(text: string, schema: z.ZodType): unknown {
    const trimmed = text.trim();
    try {
        return convertToPrimitive(JSON.parse(trimmed), schema);
    } catch {
        return convertToPrimitive(trimmed, schema);
    }
}

function findJsonStructures(text: string): string[] {
    const matches: string[] = [];
    let depth = 0;
    let start = -1;

    for (let i = 0; i < text.length; i++) {
        const char = text[i];
        if (char === '{' || char === '[') {
            if (depth === 0) start = i;
            depth++;
        } else if (char === '}' || char === ']') {
            depth--;
            if (depth === 0 && start !== -1) {
                const candidate = text.slice(start, i + 1);
                try {
                    JSON.parse(candidate);
                    matches.push(candidate);
                } catch {
                    // Invalid JSON, skip
                }
            }
        }
    }

    return matches;
}

function findLongestString(strings: string[]): string {
    return strings.reduce((longest, current) =>
        current.length > longest.length ? current : longest,
    );
}

function unescapeJsonValues(json: unknown): unknown {
    if (typeof json === 'string') {
        return unescapeString(json);
    }
    if (Array.isArray(json)) {
        return json.map(unescapeJsonValues);
    }
    if (typeof json === 'object' && json !== null) {
        return Object.fromEntries(
            Object.entries(json).map(([key, value]) => [key, unescapeJsonValues(value)]),
        );
    }
    return json;
}

function unescapeString(text: string): string {
    return text
        .replace(/\\"/g, '"')
        .replace(/\\n/g, '\n')
        .replace(/\\r/g, '\r')
        .replace(/\\t/g, '\t')
        .replace(/\\\\/g, '\\')
        .replace(/\\u([0-9a-fA-F]{4})/g, (_, code) =>
            String.fromCharCode(Number.parseInt(code, 16)),
        );
}
