import { z } from "zod/v4";

/**
 * Creates a system prompt that instructs the model to output structured data
 * matching the provided Zod schema.
 *
 * Use this with `generateText` when the provider doesn't support native
 * structured outputs, then parse the response with `parseObject`.
 *
 * @param schema - A Zod schema defining the expected output structure
 * @returns A system prompt string with JSON schema instructions
 *
 * @example
 * ```ts
 * import { generateText } from 'ai';
 * import { createSchemaPrompt, parseObject } from '@jterrazz/intelligence';
 *
 * const schema = z.object({ title: z.string(), tags: z.array(z.string()) });
 *
 * const { text } = await generateText({
 *   model,
 *   prompt: 'Generate an article about TypeScript',
 *   system: createSchemaPrompt(schema),
 * });
 *
 * const result = parseObject(text, schema);
 * ```
 */
export function createSchemaPrompt<T>(schema: z.ZodType<T>): string {
  const jsonSchema = z.toJSONSchema(schema);
  const schemaJson = JSON.stringify(jsonSchema, null, 2);

  const isPrimitive = ["boolean", "integer", "number", "string"].includes(
    jsonSchema.type as string,
  );

  if (isPrimitive) {
    return `<OUTPUT_FORMAT>
You must respond with a ${jsonSchema.type} value that matches this schema:

\`\`\`json
${schemaJson}
\`\`\`

Your response should be only the ${jsonSchema.type} value, without any JSON wrapping or additional text.
</OUTPUT_FORMAT>`;
  }

  return `<OUTPUT_FORMAT>
You must respond with valid JSON that matches this JSON schema:

\`\`\`json
${schemaJson}
\`\`\`

Your response must be parseable JSON that validates against this schema. Do not include any text outside the JSON.
</OUTPUT_FORMAT>`;
}
