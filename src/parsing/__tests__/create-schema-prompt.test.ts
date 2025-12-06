import { describe, expect, it } from 'vitest';
import { z } from 'zod/v4';

import { createSchemaPrompt } from '../create-schema-prompt.js';

describe('createSchemaPrompt', () => {
    describe('object schemas', () => {
        it('generates JSON output instructions for object schema', () => {
            const schema = z.object({
                tags: z.array(z.string()),
                title: z.string(),
            });

            const prompt = createSchemaPrompt(schema);

            expect(prompt).toContain('<OUTPUT_FORMAT>');
            expect(prompt).toContain('</OUTPUT_FORMAT>');
            expect(prompt).toContain('valid JSON');
            expect(prompt).toContain('```json');
            expect(prompt).toContain('"type": "object"');
            expect(prompt).toContain('"title"');
            expect(prompt).toContain('"tags"');
            expect(prompt).toContain('Do not include any text outside the JSON');
        });

        it('generates JSON output instructions for array schema', () => {
            const schema = z.array(z.string());

            const prompt = createSchemaPrompt(schema);

            expect(prompt).toContain('valid JSON');
            expect(prompt).toContain('"type": "array"');
        });
    });

    describe('primitive schemas', () => {
        it('generates primitive-specific instructions for string schema', () => {
            const schema = z.string().min(5);

            const prompt = createSchemaPrompt(schema);

            expect(prompt).toContain('<OUTPUT_FORMAT>');
            expect(prompt).toContain('string value');
            expect(prompt).toContain('"type": "string"');
            expect(prompt).toContain('without any JSON wrapping');
        });

        it('generates primitive-specific instructions for number schema', () => {
            const schema = z.number().min(0).max(100);

            const prompt = createSchemaPrompt(schema);

            expect(prompt).toContain('number value');
            expect(prompt).toContain('"type": "number"');
            expect(prompt).toContain('without any JSON wrapping');
        });

        it('generates primitive-specific instructions for boolean schema', () => {
            const schema = z.boolean();

            const prompt = createSchemaPrompt(schema);

            expect(prompt).toContain('boolean value');
            expect(prompt).toContain('"type": "boolean"');
        });
    });
});
