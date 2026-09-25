import type { LanguageModelV4CallOptions, LanguageModelV4Prompt } from '@ai-sdk/provider';
import type { LanguageModelMiddleware } from 'ai';

function buildInstruction(responseFormat: LanguageModelV4CallOptions['responseFormat']): string {
    if (responseFormat?.type !== 'json') {
        return '';
    }

    const lines = ['You must respond with valid JSON only — no prose, no markdown code fences.'];
    if (responseFormat.schema) {
        lines.push(
            'The JSON must strictly conform to this JSON schema:',
            JSON.stringify(responseFormat.schema),
        );
    }
    return lines.join('\n');
}

// The user message, not a system one: gateways fronting CLI agents bury injected system messages under their own persona.
function appendToLastUserMessage(
    prompt: LanguageModelV4Prompt,
    instruction: string,
): LanguageModelV4Prompt {
    const lastUserIndex = prompt.findLastIndex((message) => message.role === 'user');
    if (lastUserIndex === -1) {
        return [...prompt, { content: [{ text: instruction, type: 'text' }], role: 'user' }];
    }

    return prompt.map((message, index) => {
        if (index !== lastUserIndex || message.role !== 'user') {
            return message;
        }

        // One text part serializes as a plain string, which proxies and prompt-matching tooling handle more reliably.
        const lastTextIndex = message.content.findLastIndex((part) => part.type === 'text');
        if (lastTextIndex === -1) {
            return {
                ...message,
                content: [...message.content, { text: instruction, type: 'text' as const }],
            };
        }

        return {
            ...message,
            content: message.content.map((part, partIndex) => {
                if (partIndex !== lastTextIndex || part.type !== 'text') {
                    return part;
                }
                return { ...part, text: `${part.text}\n\n${instruction}` };
            }),
        };
    });
}

/** Restates a JSON response format's schema in the last user message, for gateways that drop the native field. */
export function createSchemaInstructionMiddleware(): LanguageModelMiddleware {
    return {
        specificationVersion: 'v4',
        transformParams: async ({ params }) => {
            const instruction = buildInstruction(params.responseFormat);
            if (instruction === '') {
                return params;
            }

            return {
                ...params,
                prompt: appendToLastUserMessage(params.prompt, instruction),
            };
        },
    };
}
