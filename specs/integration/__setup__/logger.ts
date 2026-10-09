import type { LoggerPort } from '@jterrazz/telemetry';

export type LogRecord = { event: string; level: string; meta?: Record<string, unknown> };

/** A logger that keeps what it is told, in order, for a spec to read whole. */
export function recordingLogger(): { logger: LoggerPort; records: LogRecord[] } {
    const records: LogRecord[] = [];
    const at =
        (level: string) =>
        (event: string, meta?: Record<string, unknown>): void => {
            records.push(meta === undefined ? { event, level } : { event, level, meta });
        };
    const logger: LoggerPort = {
        child: () => logger,
        debug: at('debug'),
        error: at('error'),
        info: at('info'),
        warn: at('warn'),
    };
    return { logger, records };
}
