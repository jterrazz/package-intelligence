import { Langfuse } from "langfuse";

// Ports
import type {
  GenerationParams,
  ObservabilityPort,
  TraceParams,
} from "../ports/observability.port.js";

export interface LangfuseConfig {
  secretKey: string;
  publicKey: string;
  baseUrl?: string;
  environment?: string;
  release?: string;
}

/**
 * Langfuse adapter implementing ObservabilityPort
 */
export class LangfuseAdapter implements ObservabilityPort {
  private readonly client: Langfuse;

  constructor(config: LangfuseConfig) {
    this.client = new Langfuse({
      secretKey: config.secretKey,
      publicKey: config.publicKey,
      baseUrl: config.baseUrl,
      environment: config.environment,
      release: config.release,
    });
  }

  async flush(): Promise<void> {
    await this.client.flushAsync();
  }

  generation(params: GenerationParams): void {
    const usageDetails = params.usage
      ? {
          input: params.usage.input,
          output: params.usage.output,
          total: params.usage.total ?? params.usage.input + params.usage.output,
          ...(params.usage.reasoning !== undefined && {
            reasoning: params.usage.reasoning,
          }),
          ...(params.usage.cacheRead !== undefined && {
            cache_read: params.usage.cacheRead,
          }),
          ...(params.usage.cacheWrite !== undefined && {
            cache_write: params.usage.cacheWrite,
          }),
        }
      : undefined;

    const costDetails = params.cost
      ? {
          total: params.cost.total,
          ...(params.cost.input !== undefined && { input: params.cost.input }),
          ...(params.cost.output !== undefined && { output: params.cost.output }),
        }
      : undefined;

    this.client.generation({
      traceId: params.traceId,
      name: params.name,
      model: params.model,
      input: params.input,
      output: params.output,
      startTime: params.startTime,
      endTime: params.endTime,
      usageDetails,
      costDetails,
      metadata: params.metadata,
    });
  }

  async shutdown(): Promise<void> {
    await this.client.shutdownAsync();
  }

  trace(params: TraceParams): void {
    this.client.trace({
      id: params.id,
      name: params.name,
      metadata: params.metadata,
    });
  }
}
