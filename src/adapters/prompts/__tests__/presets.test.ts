import { describe, expect, it } from '@jterrazz/test';

import { PROMPTS } from '../library/index.js';
import { SystemPromptAdapter } from '../system-prompt.adapter.js';

describe('Prompt Library Presets', () => {
    it('should generate the correct prompt for DISCORD_COMMUNITY_ANIMATOR', () => {
        // Given - a Discord community animator preset
        const prompt = new SystemPromptAdapter(PROMPTS.PRESETS.COMMUNITY_ANIMATOR);

        // When - generating the prompt
        const result = prompt.generate();

        // Then - it should match the expected snapshot
        expect(result).toMatchSnapshot();
    });

    it('should generate the correct prompt for EMPATHETIC_SUPPORT_AGENT', () => {
        // Given - an empathetic support agent preset
        const prompt = new SystemPromptAdapter(PROMPTS.PRESETS.EMPATHETIC_SUPPORT_AGENT);

        // When - generating the prompt
        const result = prompt.generate();

        // Then - it should match the expected snapshot
        expect(result).toMatchSnapshot();
    });

    it('should generate the correct prompt for CREATIVE_BRAINSTORMER', () => {
        // Given - a creative brainstormer preset
        const prompt = new SystemPromptAdapter(PROMPTS.PRESETS.CREATIVE_BRAINSTORMER);

        // When - generating the prompt
        const result = prompt.generate();

        // Then - it should match the expected snapshot
        expect(result).toMatchSnapshot();
    });
});
