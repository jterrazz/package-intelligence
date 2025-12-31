import { describe, expect, it } from "vitest";
import { z } from "zod/v4";

import { parseObject, ParseObjectError } from "../parse-object.js";

const articleSchema = z.object({
  content: z.string(),
  tags: z.array(z.string()),
  title: z.string(),
});

const validArticle = {
  content: "Test content",
  tags: ["test", "ai"],
  title: "Test Article",
};

const validArticleJson = JSON.stringify(validArticle);

describe("parseObject", () => {
  describe("object parsing", () => {
    it("parses valid JSON object", () => {
      const text = validArticleJson;
      const result = parseObject(text, articleSchema);
      expect(result).toEqual(validArticle);
    });

    it("extracts JSON object from surrounding prose", () => {
      const text = `Here's the article: ${validArticleJson} - end of article`;
      const result = parseObject(text, articleSchema);
      expect(result).toEqual(validArticle);
    });

    it("parses JSON from markdown code block", () => {
      const text = `\`\`\`json\n${validArticleJson}\n\`\`\``;
      const result = parseObject(text, articleSchema);
      expect(result).toEqual(validArticle);
    });

    it("handles newlines in JSON values", () => {
      const text = `{
                "content": "Test\\ncontent\\nwith\\nnewlines",
                "tags": ["test", "ai"],
                "title": "Test\\nArticle"
            }`;
      const result = parseObject(text, articleSchema);
      expect(result).toEqual({
        content: "Test\ncontent\nwith\nnewlines",
        tags: ["test", "ai"],
        title: "Test\nArticle",
      });
    });

    it("handles escaped characters in JSON", () => {
      const text = String.raw`{"content": "Test\ncontent\twith\r\nescapes", "tags": ["test\u0020ai", "escaped\"quotes\""], "title": "Test\\Article"}`;
      const result = parseObject(text, articleSchema);
      expect(result).toEqual({
        content: "Test\ncontent\twith\r\nescapes",
        tags: ["test ai", 'escaped"quotes"'],
        title: "Test\\Article",
      });
    });
  });

  describe("array parsing", () => {
    it("parses JSON array", () => {
      const text = '["test", "ai", "content"]';
      const schema = z.array(z.string());
      const result = parseObject(text, schema);
      expect(result).toEqual(["test", "ai", "content"]);
    });

    it("parses array of objects from markdown code block", () => {
      const text = `\`\`\`json\n[${validArticleJson}]\n\`\`\``;
      const schema = z.array(articleSchema);
      const result = parseObject(text, schema);
      expect(result).toEqual([validArticle]);
    });
  });

  describe("primitive parsing", () => {
    it("parses string value", () => {
      const text = '"test string"';
      const result = parseObject(text, z.string());
      expect(result).toBe("test string");
    });

    it("parses number value", () => {
      const text = "42";
      const result = parseObject(text, z.number());
      expect(result).toBe(42);
    });

    it("parses boolean value", () => {
      const text = "true";
      const result = parseObject(text, z.boolean());
      expect(result).toBe(true);
    });

    it("parses null value", () => {
      const text = "null";
      const result = parseObject(text, z.null());
      expect(result).toBeNull();
    });
  });

  describe("error handling", () => {
    it("throws ParseObjectError for invalid JSON", () => {
      const text = "{invalid json}";
      expect(() => parseObject(text, articleSchema)).toThrow(ParseObjectError);
    });

    it("throws ParseObjectError when schema validation fails", () => {
      const text = JSON.stringify({
        content: "Test",
        tags: ["test"],
        title: 123,
      });
      expect(() => parseObject(text, articleSchema)).toThrow(ParseObjectError);
    });

    it("throws ParseObjectError when no object found", () => {
      const text = "No JSON object here";
      expect(() => parseObject(text, articleSchema)).toThrow(ParseObjectError);
    });

    it("throws ParseObjectError when no array found", () => {
      const text = "No array here";
      const schema = z.array(z.string());
      expect(() => parseObject(text, schema)).toThrow(ParseObjectError);
    });

    it("throws ParseObjectError for unsupported schema type", () => {
      const text = "test";
      const schema = z.date();
      expect(() => parseObject(text, schema)).toThrow(ParseObjectError);
    });

    it("throws ParseObjectError for union when no object or array found", () => {
      const text = "just plain text";
      const schema = z.union([
        z.object({ type: z.literal("a") }),
        z.object({ type: z.literal("b") }),
      ]);
      expect(() => parseObject(text, schema)).toThrow(ParseObjectError);
    });

    it("includes original text in error", () => {
      const text = "{invalid json}";
      try {
        parseObject(text, articleSchema);
        throw new Error("Should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(ParseObjectError);
        expect((error as ParseObjectError).text).toBe(text);
      }
    });
  });

  describe("complex scenarios", () => {
    it("parses complex nested JSON with escaped quotes", () => {
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
      expect(result.category).toBe("sports");
      expect(result.countries).toEqual(["us"]);
      expect(result.perspectives[0]?.digest).toContain('"Big 3" experiment');
      expect(result.synopsis).toBe("A major trade occurred.");
    });

    it("handles text with multiple whitespace variations", () => {
      const text = `Here's the\n\n  article:   \n\n${validArticleJson}\n\n`;
      const result = parseObject(text, articleSchema);
      expect(result).toEqual(validArticle);
    });

    it("selects largest valid JSON when multiple structures present", () => {
      const smallJson = '{"title": "Small"}';
      const text = `First: ${smallJson}, Second: ${validArticleJson}`;
      const result = parseObject(text, articleSchema);
      expect(result).toEqual(validArticle);
    });
  });

  describe("union types", () => {
    it("parses z.union - variant A", () => {
      const schema = z.union([
        z.object({ type: z.literal("a"), value: z.string() }),
        z.object({ type: z.literal("b"), count: z.number() }),
      ]);
      const text = '{"type": "a", "value": "hello"}';
      expect(parseObject(text, schema)).toEqual({ type: "a", value: "hello" });
    });

    it("parses z.union - variant B", () => {
      const schema = z.union([
        z.object({ type: z.literal("a"), value: z.string() }),
        z.object({ type: z.literal("b"), count: z.number() }),
      ]);
      const text = '{"type": "b", "count": 42}';
      expect(parseObject(text, schema)).toEqual({ type: "b", count: 42 });
    });

    it("parses z.discriminatedUnion", () => {
      const schema = z.discriminatedUnion("action", [
        z.object({ action: z.literal("join"), eventId: z.string() }),
        z.object({ action: z.literal("create"), name: z.string() }),
      ]);
      const text = '```json\n{"action": "create", "name": "Test"}\n```';
      expect(parseObject(text, schema)).toEqual({ action: "create", name: "Test" });
    });

    it("parses discriminated union from surrounding prose", () => {
      const schema = z.discriminatedUnion("action", [
        z.object({ action: z.literal("join"), eventId: z.string() }),
        z.object({ action: z.literal("create"), name: z.string() }),
      ]);
      const text = 'Here is the result: {"action": "join", "eventId": "evt-123"} - done';
      expect(parseObject(text, schema)).toEqual({ action: "join", eventId: "evt-123" });
    });

    it("parses union of arrays", () => {
      const schema = z.union([z.array(z.string()), z.array(z.number())]);
      const text = '["a", "b", "c"]';
      expect(parseObject(text, schema)).toEqual(["a", "b", "c"]);
    });

    it("throws when union variant does not match", () => {
      const schema = z.discriminatedUnion("action", [
        z.object({ action: z.literal("join"), eventId: z.string() }),
        z.object({ action: z.literal("create"), name: z.string() }),
      ]);
      const text = '{"action": "delete", "id": "123"}';
      expect(() => parseObject(text, schema)).toThrow(ParseObjectError);
    });
  });

  describe("wrapper types", () => {
    it("parses z.optional wrapping an object", () => {
      const schema = z.object({ name: z.string() }).optional();
      const text = '{"name": "test"}';
      expect(parseObject(text, schema)).toEqual({ name: "test" });
    });

    it("parses z.nullable wrapping an object", () => {
      const schema = z.object({ name: z.string() }).nullable();
      const text = '{"name": "test"}';
      expect(parseObject(text, schema)).toEqual({ name: "test" });
    });

    it("parses z.default wrapping an object", () => {
      const schema = z.object({ name: z.string() }).default({ name: "default" });
      const text = '{"name": "custom"}';
      expect(parseObject(text, schema)).toEqual({ name: "custom" });
    });

    it("parses schema with .transform()", () => {
      const schema = z.object({ value: z.string() }).transform((obj) => ({
        ...obj,
        transformed: true,
      }));
      const text = '{"value": "test"}';
      const result = parseObject(text, schema);
      expect(result).toEqual({ value: "test", transformed: true });
    });

    it("parses schema with .refine()", () => {
      const schema = z.object({ value: z.number() }).refine((obj) => obj.value > 0, {
        message: "Value must be positive",
      });
      const text = '{"value": 42}';
      expect(parseObject(text, schema)).toEqual({ value: 42 });
    });

    it("parses deeply nested wrapper types", () => {
      const schema = z
        .object({ name: z.string() })
        .optional()
        .nullable()
        .default({ name: "default" });
      const text = '{"name": "nested"}';
      expect(parseObject(text, schema)).toEqual({ name: "nested" });
    });

    it("parses optional array", () => {
      const schema = z.array(z.string()).optional();
      const text = '["a", "b", "c"]';
      expect(parseObject(text, schema)).toEqual(["a", "b", "c"]);
    });
  });
});
