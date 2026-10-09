import { http, openai } from '@jterrazz/test';
import { generateText, Output } from 'ai';
import { describe, expect, test } from 'vitest';
import { z } from 'zod';

import { createIntelligence } from '../../../src/index.js';
import { GATEWAY_COMPLETIONS, PROVIDERS } from '../__setup__/providers.js';
import { integration } from '../integration.specification.js';

const SUMMARY = z.object({ headline: z.string(), words: z.number() });

describe('structured-output', () => {
    test('a gateway is told the schema in the prompt, and its fenced JSON is read as the object', async () => {
        // Given - a gateway that answers JSON inside a markdown fence, asked only by a prompt that states the schema
        const result = await integration
            .intercept({
                request: http.post(GATEWAY_COMPLETIONS, {
                    body: 'The JSON must strictly conform to this JSON schema:',
                }),
                required: true,
                response: openai.reply('```json\n{"headline":"Rain in Paris","words":3}\n```'),
            })
            .call(async () => {
                const intelligence = createIntelligence({
                    agents: { summarizer: { model: 'primary-model', provider: 'gateway' } },
                    providers: PROVIDERS,
                });
                const { output } = await generateText({
                    model: intelligence.model('summarizer'),
                    output: Output.object({ schema: SUMMARY }),
                    prompt: 'Summarize the weather',
                });
                return output;
            });

        // Then - the object the schema describes
        expect(result.value).toMatch({ headline: 'Rain in Paris', words: 3 });
    });
});
