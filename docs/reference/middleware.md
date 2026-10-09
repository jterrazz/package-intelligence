# Middleware

`src/middleware/` holds four `LanguageModelMiddleware` factories a consumer wraps a model with through the AI SDK's `wrapLanguageModel`, and `src/model/` the fallback, the one wrapper that is a model. Three middleware observe a call — agent, cost, logging — and one changes what the model is asked: schema instruction. `createIntelligence` composes the agent, cost, logging and fallback pieces itself ([Architecture](../concepts/architecture.md#what-createintelligence-wires)); `createGatewayProvider` applies schema instruction to every model it returns ([Providers](providers.md#gateway)).

## Agent

```typescript
import { createAgentMiddleware } from '@jterrazz/intelligence';
import { wrapLanguageModel } from 'ai';

const model = wrapLanguageModel({
    middleware: [createAgentMiddleware({ agentName: 'summarizer' })],
    model: provider.model('google/gemini-2.5-flash-lite'),
});
```

Renames the AI SDK's inference span after the agent and sets `gen_ai.agent.name` on it, from inside the provider call, where the AI SDK keeps that span active. Without it the span is named after the model, and the agent is named only on the parent `invoke_agent` span, which a backend ingesting the inference span alone (Langfuse) never reads. With no span active — no OpenTelemetry SDK registered — it does nothing.

## Cost

```typescript
import { createCostMiddleware } from '@jterrazz/intelligence';

const middleware = createCostMiddleware({ pricing: { input: 0.1, output: 0.4 } });
```

Writes the generation's cost in USD as `gen_ai.usage.cost` on the inference span, which Langfuse reads before any price of its own catalogue:

1. the cost the provider reported, `providerMetadata.openrouter.usage.cost`, when it is a number above zero;
2. else, with `pricing` — USD per million tokens — the usage priced: `(input × pricing.input + output × pricing.output) / 1 000 000`;
3. else nothing, and the backend prices the generation itself from the model id.

A stream is costed on its `finish` part, which carries the usage: the span is taken when the call starts, since the AI SDK ends it with that part, outside the call's context.

## Logging

```typescript
import { createLoggingMiddleware } from '@jterrazz/intelligence';

const middleware = createLoggingMiddleware({
    include: { content: false, params: false, usage: true },
    logger, // a LoggerPort of @jterrazz/telemetry
});
```

| Event                                  | Level   | Carries                                                                                                               |
| -------------------------------------- | ------- | --------------------------------------------------------------------------------------------------------------------- |
| `ai.generate.start`, `ai.stream.start` | `debug` | the model id; the call's `params` under `include.params`                                                              |
| `ai.generate.complete`                 | `debug` | the model id, `durationMs`, `finishReason`; `usage` unless `include.usage` is false; the text under `include.content` |
| `ai.stream.complete`                   | `debug` | the model id, `durationMs`; the streamed text under `include.content`                                                 |
| `ai.generate.error`, `ai.stream.error` | `error` | the model id, `durationMs`, the error's message — then the error is thrown on                                         |

`params` and `content` are opt-in because they carry the prompt and the answer whole, which a caller may not want in its logs.

## Schema instruction

```typescript
import { createSchemaInstructionMiddleware } from '@jterrazz/intelligence';
```

For a structured request — a `json` response format — it appends an instruction to the last user message: answer JSON only, with no prose and no fence, and, when the format carries a schema, the schema itself. The last user message rather than a system one, because a gateway fronting a CLI agent buries an injected system message under its own persona. A prompt with no user message gets one. The native `responseFormat` stays as it was, so a backend that honours it still reads it; the instruction is the net beneath it. A text request is left untouched.

## Fallback

```typescript
import { createFallbackModel } from '@jterrazz/intelligence';

const model = createFallbackModel({ fallback, logger, primary });
```

A `LanguageModelV4` that sends each call to `primary`, and to `fallback` when the primary fails with an error the AI SDK marks retryable: an `APICallError` of status `408`, `409`, `429` or `>= 500`, or a network failure, which the providers' SDKs raise as an `APICallError` too. Every other error — a `400` among them — reaches the caller as thrown. Each switch is logged as `ai.fallback.triggered`, at `warn`, with both model ids and the primary's error message. It reports the primary's provider, model id and supported URLs as its own.

## Related

- [Providers](providers.md) — the models these wrap.
