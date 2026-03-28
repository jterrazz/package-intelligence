import { describe, expect, test } from "vitest";

import { parseText } from "../parse-text.js";

describe("parseText", () => {
  describe("empty and basic input", () => {
    test("returns empty string for empty input", () => {
      // Given -- an empty string input
      const input = "";

      // Then -- returns empty string
      expect(parseText(input)).toBe("");
    });

    test("returns trimmed text for simple input", () => {
      // Given -- a string with leading and trailing spaces
      const input = "  hello world  ";

      // Then -- returns trimmed text
      expect(parseText(input)).toBe("hello world");
    });

    test("preserves newlines", () => {
      // Given -- a string with newlines
      const input = "hello\nworld";

      // Then -- preserves the newlines
      expect(parseText(input)).toBe("hello\nworld");
    });
  });

  describe("BOM handling", () => {
    test("removes BOM character at start", () => {
      // Given -- a string with BOM at the start
      const input = "\uFEFFhello";

      // Then -- BOM is removed
      expect(parseText(input)).toBe("hello");
    });

    test("removes BOM in middle of text (via invisible char removal)", () => {
      // Given -- a string with BOM in the middle
      const input = "hello\uFEFFworld";

      // Then -- BOM is removed
      expect(parseText(input)).toBe("helloworld");
    });
  });

  describe("line ending normalization", () => {
    test("converts CRLF to LF", () => {
      // Given -- a string with CRLF line endings
      const input = "hello\r\nworld";

      // Then -- CRLF is converted to LF
      expect(parseText(input)).toBe("hello\nworld");
    });

    test("converts standalone CR to LF", () => {
      // Given -- a string with standalone CR
      const input = "hello\rworld";

      // Then -- CR is converted to LF
      expect(parseText(input)).toBe("hello\nworld");
    });
  });

  describe("AI citation removal", () => {
    test("removes oaicite markers", () => {
      // Given -- text with an oaicite marker
      const input = "Some text (oaicite:0){index=0} more text";

      // Then -- the citation marker is removed
      expect(parseText(input)).toBe("Some text more text");
    });

    test("removes multiple citation markers", () => {
      // Given -- text with multiple oaicite markers
      const input = "Text (oaicite:1){index=1} and (oaicite:2){index=2} here";

      // Then -- all citation markers are removed
      expect(parseText(input)).toBe("Text and here");
    });
  });

  describe("invisible character removal", () => {
    test("removes zero-width space", () => {
      // Given -- a string with zero-width space
      const input = "hello\u200Bworld";

      // Then -- the zero-width space is removed
      expect(parseText(input)).toBe("helloworld");
    });

    test("removes zero-width non-joiner", () => {
      // Given -- a string with zero-width non-joiner
      const input = "hello\u200Cworld";

      // Then -- the zero-width non-joiner is removed
      expect(parseText(input)).toBe("helloworld");
    });

    test("removes soft hyphen", () => {
      // Given -- a string with soft hyphen
      const input = "hello\u00ADworld";

      // Then -- the soft hyphen is removed
      expect(parseText(input)).toBe("helloworld");
    });

    test("removes direction marks", () => {
      // Given -- a string with direction marks
      const input = "hello\u200E\u200Fworld";

      // Then -- the direction marks are removed
      expect(parseText(input)).toBe("helloworld");
    });

    test("removes word joiner", () => {
      // Given -- a string with word joiner
      const input = "hello\u2060world";

      // Then -- the word joiner is removed
      expect(parseText(input)).toBe("helloworld");
    });
  });

  describe("ASCII control character removal", () => {
    test("removes null character", () => {
      // Given -- a string with null character
      const input = "hello\x00world";

      // Then -- the null character is removed
      expect(parseText(input)).toBe("helloworld");
    });

    test("removes bell character", () => {
      // Given -- a string with bell character
      const input = "hello\x07world";

      // Then -- the bell character is removed
      expect(parseText(input)).toBe("helloworld");
    });

    test("removes delete character", () => {
      // Given -- a string with delete character
      const input = "hello\x7Fworld";

      // Then -- the delete character is removed
      expect(parseText(input)).toBe("helloworld");
    });

    test("preserves tab and newline", () => {
      // Given -- a string with tab and newline
      const input = "hello\tworld\n!";

      // Then -- tab and newline are preserved
      expect(parseText(input)).toBe("hello\tworld\n!");
    });
  });

  describe("em/en dash normalization", () => {
    test("converts em dash with spaces to comma", () => {
      // Given -- text with em dash surrounded by spaces
      const input = "hello — world";

      // Then -- em dash is converted to comma
      expect(parseText(input)).toBe("hello, world");
    });

    test("converts en dash with spaces to comma", () => {
      // Given -- text with en dash surrounded by spaces
      const input = "hello – world";

      // Then -- en dash is converted to comma
      expect(parseText(input)).toBe("hello, world");
    });

    test("converts horizontal bar with spaces to comma", () => {
      // Given -- text with horizontal bar surrounded by spaces
      const input = "hello ― world";

      // Then -- horizontal bar is converted to comma
      expect(parseText(input)).toBe("hello, world");
    });

    test("converts figure dash with spaces to comma", () => {
      // Given -- text with figure dash surrounded by spaces
      const input = "hello ‒ world";

      // Then -- figure dash is converted to comma
      expect(parseText(input)).toBe("hello, world");
    });

    test("converts em dash without spaces to comma", () => {
      // Given -- text with em dash without spaces
      const input = "disparaître—ne laissant";

      // Then -- em dash is converted to comma with space
      expect(parseText(input)).toBe("disparaître, ne laissant");
    });

    test("can be disabled via options", () => {
      // Given -- text with em dash and normalization disabled
      const input = "hello — world";

      // Then -- em dash is preserved
      expect(parseText(input, { normalizeEmDashesToCommas: false })).toBe("hello — world");
    });

    test("preserves em dash when disabled (no spaces)", () => {
      // Given -- text with em dash without spaces and normalization disabled
      const input = "word—word";

      // Then -- em dash is preserved
      expect(parseText(input, { normalizeEmDashesToCommas: false })).toBe("word—word");
    });
  });

  describe("space-like character normalization", () => {
    test("converts non-breaking space to regular space", () => {
      // Given -- a string with non-breaking space
      const input = "hello\u00A0world";

      // Then -- non-breaking space becomes regular space
      expect(parseText(input)).toBe("hello world");
    });

    test("converts em space to regular space", () => {
      // Given -- a string with em space
      const input = "hello\u2003world";

      // Then -- em space becomes regular space
      expect(parseText(input)).toBe("hello world");
    });

    test("converts narrow no-break space to regular space", () => {
      // Given -- a string with narrow no-break space
      const input = "hello\u202Fworld";

      // Then -- narrow no-break space becomes regular space
      expect(parseText(input)).toBe("hello world");
    });

    test("converts ideographic space to regular space", () => {
      // Given -- a string with ideographic space
      const input = "hello\u3000world";

      // Then -- ideographic space becomes regular space
      expect(parseText(input)).toBe("hello world");
    });
  });

  describe("typography normalization", () => {
    test("converts left single quote to straight quote", () => {
      // Given -- a string with left single quote
      const input = "it\u2018s";

      // Then -- left single quote becomes straight quote
      expect(parseText(input)).toBe("it's");
    });

    test("converts right single quote to straight quote", () => {
      // Given -- a string with right single quote
      const input = "it\u2019s";

      // Then -- right single quote becomes straight quote
      expect(parseText(input)).toBe("it's");
    });

    test("converts left double quote to straight quote", () => {
      // Given -- a string with left/right double quotes
      const input = "\u201CHello\u201D";

      // Then -- curly double quotes become straight quotes
      expect(parseText(input)).toBe('"Hello"');
    });

    test("converts em dash to comma", () => {
      // Given -- a string with em dash between words
      const input = "word\u2014word";

      // Then -- em dash is converted to comma
      expect(parseText(input)).toBe("word, word");
    });

    test("converts en dash to comma", () => {
      // Given -- a string with en dash between numbers
      const input = "2020\u20132021";

      // Then -- en dash is converted to comma
      expect(parseText(input)).toBe("2020, 2021");
    });

    test("converts ellipsis to three dots", () => {
      // Given -- a string with ellipsis character
      const input = "wait\u2026";

      // Then -- ellipsis becomes three dots
      expect(parseText(input)).toBe("wait...");
    });

    test("converts bullet point to hyphen", () => {
      // Given -- a string with bullet point
      const input = "\u2022 item";

      // Then -- bullet point becomes hyphen
      expect(parseText(input)).toBe("- item");
    });
  });

  describe("multiple space collapsing", () => {
    test("collapses multiple spaces to single space", () => {
      // Given -- a string with multiple consecutive spaces
      const input = "hello    world";

      // Then -- multiple spaces collapse to single space
      expect(parseText(input)).toBe("hello world");
    });

    test("trims leading and trailing spaces", () => {
      // Given -- a string with leading and trailing spaces
      const input = "   hello world   ";

      // Then -- leading and trailing spaces are removed
      expect(parseText(input)).toBe("hello world");
    });

    test("can be disabled via options", () => {
      // Given -- a string with multiple spaces and collapsing disabled
      const input = "hello    world";

      // Then -- multiple spaces are preserved
      expect(parseText(input, { collapseSpaces: false })).toBe("hello    world");
    });
  });

  describe("NFKC normalization", () => {
    test("normalizes fullwidth characters", () => {
      // Given -- fullwidth ASCII characters
      const input = "\uFF21\uFF22\uFF23";

      // Then -- fullwidth characters become standard ASCII
      expect(parseText(input)).toBe("ABC");
    });

    test("normalizes ligatures", () => {
      // Given -- a string with fi ligature
      const input = "\uFB01le";

      // Then -- ligature is decomposed
      expect(parseText(input)).toBe("file");
    });
  });

  describe("combined scenarios", () => {
    test("handles AI-generated text with multiple issues", () => {
      // Given -- text with BOM, smart quotes, citation, em dash, and non-breaking space
      const input = "\uFEFF  Hello\u2019s world (oaicite:0){index=0} \u2014 with\u00A0spaces  ";

      // Then -- all issues are cleaned up
      expect(parseText(input)).toBe("Hello's world, with spaces");
    });

    test("handles markdown with smart quotes and dashes", () => {
      // Given -- markdown text with smart quotes and em dash
      const input = "\u201CThis is a quote\u201D \u2014 Author";

      // Then -- smart quotes and em dash are normalized
      expect(parseText(input)).toBe('"This is a quote", Author');
    });
  });
});
