import { describe, expect, test } from 'vitest';

import { NoopObservabilityAdapter } from './noop.adapter.js';

describe('NoopObservabilityAdapter', () => {
    const adapter = new NoopObservabilityAdapter();

    test('generation() does not throw', () => {
        // Given -- a generation call with valid params
        const params = {
            traceId: 'trace-1',
            name: 'test-generation',
            model: 'gpt-4',
            input: 'hello',
            output: 'world',
            startTime: new Date(),
            endTime: new Date(),
        };

        // Then -- it completes without throwing
        expect(() => adapter.generation(params)).not.toThrow();
    });

    test('trace() does not throw', () => {
        // Given -- a trace call with valid params
        const params = {
            id: 'trace-1',
            name: 'test-trace',
        };

        // Then -- it completes without throwing
        expect(() => adapter.trace(params)).not.toThrow();
    });

    test('flush() resolves without error', async () => {
        // Given -- a call to flush
        const result = adapter.flush();

        // Then -- it resolves successfully
        await expect(result).resolves.toBeUndefined();
    });

    test('shutdown() resolves without error', async () => {
        // Given -- a call to shutdown
        const result = adapter.shutdown();

        // Then -- it resolves successfully
        await expect(result).resolves.toBeUndefined();
    });
});
