import { trace } from '@opentelemetry/api';
import { afterEach, describe, expect, test, vi } from 'vitest';

import { createAgentMiddleware } from './agent.middleware.js';

function createMockSpan() {
    return { setAttribute: vi.fn(), updateName: vi.fn() };
}

const callArgs = () => ({
    doGenerate: vi.fn().mockResolvedValue({ content: [], finishReason: 'stop', usage: {} }),
    doStream: vi.fn().mockResolvedValue({ stream: new ReadableStream() }),
    params: {} as never,
    model: {} as never,
});

describe('createAgentMiddleware', () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    test('names the active span after the agent before generating', async () => {
        // Given -- an active inference span
        const span = createMockSpan();
        vi.spyOn(trace, 'getActiveSpan').mockReturnValue(span as never);
        const middleware = createAgentMiddleware({ agentName: 'articleComposition' });
        const args = callArgs();

        // When
        await middleware.wrapGenerate?.(args);

        // Then
        expect(span.updateName).toHaveBeenCalledExactlyOnceWith('articleComposition');
        expect(span.setAttribute).toHaveBeenCalledExactlyOnceWith(
            'gen_ai.agent.name',
            'articleComposition',
        );
        expect(args.doGenerate).toHaveBeenCalledOnce();
    });

    test('also names the span on the streaming path', async () => {
        // Given
        const span = createMockSpan();
        vi.spyOn(trace, 'getActiveSpan').mockReturnValue(span as never);
        const middleware = createAgentMiddleware({ agentName: 'reportIngestion' });
        const args = callArgs();

        // When
        await middleware.wrapStream?.(args);

        // Then
        expect(span.updateName).toHaveBeenCalledExactlyOnceWith('reportIngestion');
        expect(args.doStream).toHaveBeenCalledOnce();
    });

    test('never throws without an active span or with a broken span', async () => {
        // Given -- no span, then a span whose updateName explodes
        vi.spyOn(trace, 'getActiveSpan').mockReturnValueOnce(undefined);
        const middleware = createAgentMiddleware({ agentName: 'x' });

        // When / Then
        await expect(middleware.wrapGenerate?.(callArgs())).resolves.toBeDefined();

        const broken = {
            setAttribute: vi.fn(),
            updateName: vi.fn(() => {
                throw new Error('telemetry backend exploded');
            }),
        };
        vi.spyOn(trace, 'getActiveSpan').mockReturnValue(broken as never);
        await expect(middleware.wrapGenerate?.(callArgs())).resolves.toBeDefined();
    });
});
