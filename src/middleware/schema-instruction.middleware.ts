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

        // Merge into the last text part rather than appending a new part:
        // A single-part text message serializes as a plain string, which
        // Proxies and prompt-matching tooling handle more reliably.
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

/**
 * Creates middleware that injects the JSON schema of a structured-output
 * request into the last user message.
 *
 * Some gateways silently drop the native structured-output field when
 * translating to their backend, so the model never sees the schema and
 * answers in free prose. This middleware re-states the schema as part of the
 * user message so structured output works regardless. It targets the user
 * message rather than a system message because gateways backed by cloaked
 * CLI agents bury injected system messages under their own persona prompt and
 * ignore them. The original `responseFormat` is left untouched: backends that
 * honor it get the native signal too.
 *
 * No-op for text generations (no `responseFormat`, or `type: 'text'`).
 */
export function createSchemaInstructionMiddleware(): LanguageModelMiddleware {
    return {
        specificationVersion: 'v4',
        transformParams: ({ params }) => {
            const instruction = buildInstruction(params.responseFormat);
            if (!instruction) {
                return Promise.resolve(params);
            }

            return Promise.resolve({
                ...params,
                prompt: appendToLastUserMessage(params.prompt, instruction),
            });
        },
    };
}
