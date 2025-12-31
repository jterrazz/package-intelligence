import type { GenerationParams, ObservabilityPort, TraceParams } from "../ports/observability.port.js";

/**
 * No-op adapter that silently discards all observability data.
 * Useful for testing, development, or when observability is disabled.
 */
export class NoopObservabilityAdapter implements ObservabilityPort {
  trace(_params: TraceParams): void {
    // No-op
  }

  generation(_params: GenerationParams): void {
    // No-op
  }

  async flush(): Promise<void> {
    // No-op
  }

  async shutdown(): Promise<void> {
    // No-op
  }
}
