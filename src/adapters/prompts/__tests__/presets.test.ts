import { describe, expect, it } from '@jterrazz/test';

import { PROMPT_LIBRARY } from '../library/index.js';
import { SystemPromptAdapter } from '../system-prompt.adapter.js';

describe('Prompt Library Presets', () => {
    it('should generate the correct prompt for DISCORD_COMMUNITY_ANIMATOR', () => {
        // Given - a Discord community animator preset
        const prompt = new SystemPromptAdapter(PROMPT_LIBRARY.PRESETS.COMMUNITY_ANIMATOR);

        // When - generating the prompt
        const result = prompt.generate();

        // Then - it should match the expected snapshot
        expect(result).toMatchSnapshot();
    });

    it('should generate the correct prompt for EMPATHETIC_SUPPORT_AGENT', () => {
        // Given - an empathetic support agent preset
        const prompt = new SystemPromptAdapter(PROMPT_LIBRARY.PRESETS.EMPATHETIC_SUPPORT_AGENT);

        // When - generating the prompt
        const result = prompt.generate();

        // Then - it should match the expected snapshot
        expect(result).toMatchSnapshot();
    });

    it('should generate the correct prompt for CREATIVE_BRAINSTORMER', () => {
        // Given - a creative brainstormer preset
        const prompt = new SystemPromptAdapter(PROMPT_LIBRARY.PRESETS.CREATIVE_BRAINSTORMER);

        // When - generating the prompt
        const result = prompt.generate();

        // Then - it should match the expected snapshot
        expect(result).toMatchSnapshot();
    });
});
