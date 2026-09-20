import { expect, test } from 'vitest';

import { cleanAiText, toSentenceCase } from './formatting.js';

test('the dependency-free entry exposes both text utilities', () => {
    // Given - text an AI wrote, reached through `@jterrazz/intelligence/formatting`
    const dirty = '﻿“Hello” …';

    // Then - both utilities answer through that entry, with no AI SDK installed
    expect(cleanAiText(dirty)).toBe('"Hello" ...');
    expect(toSentenceCase('Two Years of Building Agents')).toBe('Two years of building agents');
});
