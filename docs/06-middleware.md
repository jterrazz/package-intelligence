# Middleware

`src/middleware/` holds four `LanguageModelMiddleware` factories a consumer
wraps a model with via AI SDK's `wrapLanguageModel`. Three are enrichment —
best-effort, never throwing, since a broken telemetry backend must never
break a generation — and one, schema-instruction, changes what the model is
asked. `createIntelligence` composes the first three itself
([01-architecture.md](01-architecture.md)); the fourth is applied
internally by `createGatewayProvider` ([05-providers.md](05-providers.md)).

## Agent middleware

```typescript
import { wrapLanguageModel } from 'ai';
import { createAgentMiddleware } from '@jterrazz/intelligence';

const model = wrapLanguageModel({
    model: provider.model('google/gemini-2.5-flash-lite'),
    middleware: [createAgentMiddleware({ agentName: 'summarizer' })],
});
```

Names the AI SDK's inference span after the agent — `span.updateName` plus
`gen_ai.agent.name` — inside the span's own context, since the AI SDK
activates it for the provider call. Without this, the AI SDK names that
span `chat <model>` and puts the agent identity only on the parent
`invoke_agent` span, so a backend that ingests the inference span alone
(Langfuse) would show every agent as `chat <model>`.

## Cost middleware

```typescript
import { createCostMiddleware } from '@jterrazz/intelligence';

const middleware = createCostMiddleware({
    pricing: { input: 0.1, output: 0.4 }, // USD per million tokens, fallback only
});
```

Resolution order: (1) the provider's own reported cost —
`providerMetadata.openrouter.usage.cost`, when a number greater than zero —
else (2) `pricing` × the reported token usage. When neither is known,
nothing is written and `gen_ai.request.model` is left as the bare model id,
so Langfuse can price the generation from its own catalogue; when a cost IS
determined it is set as `gen_ai.usage.cost` on `trace.getActiveSpan()`,
which Langfuse prioritizes over its own inference. Handles both `wrapGenerate`
and `wrapStream` — the streaming path reads the `finish` chunk's usage and
provider metadata through a `TransformStream`, so the cost lands after the
last token, not before the first.

## Logging middleware

```typescript
import { createLoggingMiddleware } from '@jterrazz/intelligence';

const middleware = createLoggingMiddleware({
    logger, // LoggerPort from @jterrazz/telemetry
    include: { params: false, content: false, usage: true },
});
```

Logs `ai.generate.start` / `ai.generate.complete` / `ai.generate.error`, and
the `ai.stream.*` equivalents, each carrying the model id and a duration;
`complete` adds `usage` (default on) and, when `include.content` is set, the
joined text. `start` adds the call `params` only when `include.params` is
set — both opt-ins exist because params and content can carry a prompt's
full text, which a caller may not want logged by default.

## Schema-instruction middleware

```typescript
import { createSchemaInstructionMiddleware } from '@jterrazz/intelligence';
```

No-op for a text generation (no `responseFormat`, or `type: 'text'`). For a
structured-output request it appends the schema, restated as an instruction
sentence plus the raw JSON schema, into the LAST user message rather than a
system message — chosen because a gateway backed by a cloaked CLI agent
buries an injected system message under its own persona prompt and ignores
it. The original `responseFormat` is left untouched, so a backend that
honors it natively still gets that signal too; this middleware is the net
under it, not a replacement for it. It is exported from `.` alongside the other middleware, but
`createGatewayProvider` already applies it to every model it returns —
reaching for it by hand only matters against a provider this package does
not wrap, since OpenRouter already supports structured output natively.
