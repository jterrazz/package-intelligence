import { describe, expect, test } from 'vitest';
import { z } from 'zod/v4';

import { createSchemaPrompt } from './create-schema-prompt.js';

describe('createSchemaPrompt', () => {
    describe('object schemas', () => {
        test('generates JSON output instructions for object schema', () => {
            // Given -- an object schema with title and tags fields
            const schema = z.object({
                tags: z.array(z.string()),
                title: z.string(),
            });

            const prompt = createSchemaPrompt(schema);

            // Then -- the prompt contains JSON output format instructions
            expect(prompt).toContain('<OUTPUT_FORMAT>');
            expect(prompt).toContain('</OUTPUT_FORMAT>');
            expect(prompt).toContain('valid JSON');
            expect(prompt).toContain('```json');
            expect(prompt).toContain('"type": "object"');
            expect(prompt).toContain('"title"');
            expect(prompt).toContain('"tags"');
            expect(prompt).toContain('Do not include any text outside the JSON');
        });

        test('generates JSON output instructions for array schema', () => {
            // Given -- an array of strings schema
            const schema = z.array(z.string());

            const prompt = createSchemaPrompt(schema);

            // Then -- the prompt specifies array type
            expect(prompt).toContain('valid JSON');
            expect(prompt).toContain('"type": "array"');
        });
    });

    describe('primitive schemas', () => {
        test('generates primitive-specific instructions for string schema', () => {
            // Given -- a string schema with min length constraint
            const schema = z.string().min(5);

            const prompt = createSchemaPrompt(schema);

            // Then -- the prompt contains string-specific instructions
            expect(prompt).toContain('<OUTPUT_FORMAT>');
            expect(prompt).toContain('string value');
            expect(prompt).toContain('"type": "string"');
            expect(prompt).toContain('without any JSON wrapping');
        });

        test('generates primitive-specific instructions for number schema', () => {
            // Given -- a number schema with min/max constraints
            const schema = z.number().min(0).max(100);

            const prompt = createSchemaPrompt(schema);

            // Then -- the prompt contains number-specific instructions
            expect(prompt).toContain('number value');
            expect(prompt).toContain('"type": "number"');
            expect(prompt).toContain('without any JSON wrapping');
        });

        test('generates primitive-specific instructions for boolean schema', () => {
            // Given -- a boolean schema
            const schema = z.boolean();

            const prompt = createSchemaPrompt(schema);

            // Then -- the prompt contains boolean-specific instructions
            expect(prompt).toContain('boolean value');
            expect(prompt).toContain('"type": "boolean"');
        });
    });
});
