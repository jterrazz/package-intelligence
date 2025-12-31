/**
 * Usage details for LLM generations
 */
export interface UsageDetails {
  input: number;
  output: number;
  total?: number;
  reasoning?: number;
  cacheRead?: number;
  cacheWrite?: number;
}

/**
 * Cost details for LLM generations
 */
export interface CostDetails {
  total: number;
  input?: number;
  output?: number;
}

/**
 * Parameters for creating a trace
 */
export interface TraceParams {
  id: string;
  name: string;
  metadata?: Record<string, unknown>;
}

/**
 * Parameters for recording a generation
 */
export interface GenerationParams {
  traceId: string;
  name: string;
  model: string;
  input: unknown;
  output: string;
  startTime: Date;
  endTime: Date;
  usage?: UsageDetails;
  cost?: CostDetails;
  metadata?: Record<string, unknown>;
}

/**
 * Port for observability integrations (Langfuse, Datadog, etc.)
 */
export interface ObservabilityPort {
  trace(params: TraceParams): void;
  generation(params: GenerationParams): void;
  flush(): Promise<void>;
  shutdown(): Promise<void>;
}
