# Providers

`src/provider/` turns a service address and a technical model id into an AI SDK `LanguageModelV4`, the model [Architecture](../concepts/architecture.md#what-createintelligence-wires) composes further with middleware. Two providers ship. In a configuration handed to `createIntelligence` each is a `providers` entry whose `type` names it; called directly, each is a factory whose `model(id)` returns the model.

## OpenRouter

```typescript
import { createOpenRouterProvider } from '@jterrazz/intelligence';

const openrouter = createOpenRouterProvider({
    apiKey: process.env.OPENROUTER_API_KEY,
    metadata: { application: 'my-app', website: 'https://example.com' },
});
const model = openrouter.model('anthropic/claude-sonnet-4-20250514');
```

| Config                 | Sent as                                                          |
| ---------------------- | ---------------------------------------------------------------- |
| `apiKey`               | `Authorization: Bearer <apiKey>`                                 |
| `metadata.application` | `X-OpenRouter-Title`, the name OpenRouter's dashboard attributes |
| `metadata.website`     | `HTTP-Referer`, the address it attributes                        |

Every call is a `POST https://openrouter.ai/api/v1/chat/completions` carrying the model id as written. A per-call option — reasoning effort, maximum tokens — goes through `providerOptions` at the call site, where AI SDK v7 reads it:

```typescript
await generateText({
    model,
    prompt: 'Hello!',
    providerOptions: { openrouter: { reasoning: { effort: 'high' } } },
});
```

The cost OpenRouter reports for a generation (`usage.cost` in its answer) is what the cost middleware writes on the span, before any estimate ([Middleware § Cost](middleware.md#cost)). `createOpenRouterProvider` wraps `@openrouter/ai-sdk-provider`'s `createOpenRouter`, so a consumer imports one factory per provider kind rather than the third-party SDKs, and the kind stays a value a configuration can switch on.

## Gateway

```typescript
import { createGatewayProvider } from '@jterrazz/intelligence';

const gateway = createGatewayProvider({
    apiKey: process.env.GATEWAY_API_KEY,
    baseURL: 'https://gateway.example.com/v1',
});
const model = gateway.model('some-model-id');
```

A gateway is any endpoint speaking OpenAI's Chat Completions: every call is a `POST <baseURL>/chat/completions`, its key sent as `Authorization: Bearer <apiKey>`. A gateway declared without a key is called with a bearer that holds no token — never with the `OPENAI_API_KEY` the process may hold, which the OpenAI SDK would otherwise send. It goes through `openai.chat(id)`, never the bare callable, which targets the Responses API most gateways do not implement. Every model it returns is wrapped with two nets for structured output:

- `createSchemaInstructionMiddleware` restates the JSON schema of a structured request in the last user message, because a gateway can drop the native `response_format` field when it translates the call to its own backend ([Middleware § Schema instruction](middleware.md#schema-instruction));
- the AI SDK's `extractJsonMiddleware` strips the markdown fence a gateway may wrap JSON in, even when asked not to.

A gateway takes no `metadata`: it speaks a generic protocol, with no vendor dashboard to attribute to.

## Related

- [Middleware](middleware.md) — what wraps a provider's model once `createIntelligence` resolves it.
