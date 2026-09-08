# Providers

`src/provider/` turns a service address and a technical model id into AI
SDK's own `LanguageModel` — the shape [01-architecture.md](01-architecture.md)
composes further with middleware. Two providers ship today.

## OpenRouter

```typescript
import { createOpenRouterProvider } from '@jterrazz/intelligence';

const openrouter = createOpenRouterProvider({
    apiKey: process.env.OPENROUTER_API_KEY,
    metadata: { application: 'my-app', website: 'https://example.com' },
});
const model = openrouter.model('anthropic/claude-sonnet-4-20250514');
```

`metadata.application` and `metadata.website` become the `X-OpenRouter-Title`
and `HTTP-Referer` headers OpenRouter's dashboard attributes usage by. Every
other per-call option — reasoning effort, max tokens — is no longer a
provider-factory setting: it goes through `providerOptions` at the call
site, since AI SDK v7 moved them there:

```typescript
await generateText({
    model,
    prompt: 'Hello!',
    providerOptions: { openrouter: { reasoning: { effort: 'high' } } },
});
```

`createOpenRouterProvider` (`src/provider/openrouter.provider.ts`) is a thin
wrapper over `@openrouter/ai-sdk-provider`'s `createOpenRouter` — it exists
so a consumer imports one factory per provider kind rather than the
third-party SDKs directly, keeping the provider KIND (`'openrouter'` /
`'gateway'`) a value `createIntelligence`'s config can switch on.

## Gateway

```typescript
import { createGatewayProvider } from '@jterrazz/intelligence';

const proxy = createGatewayProvider({
    baseURL: 'https://my-gateway.example.com/v1',
    apiKey: process.env.PROXY_API_KEY,
});
const model = proxy.model('some-model-id');
```

`createGatewayProvider` (`src/provider/gateway.provider.ts`) targets any
endpoint implementing the OpenAI chat-completions spec, through
`openai.chat(id)` explicitly — not the bare callable, which targets the
Responses API most gateways do not implement. Every model it returns is
wrapped with two safety nets, unconditionally:

- `createSchemaInstructionMiddleware` ([06-middleware.md](06-middleware.md))
  re-states the JSON schema of a structured-output request inside the last
  user message, because a gateway can silently drop the native
  `response_format` field when translating to its own backend.
- AI SDK's own `extractJsonMiddleware` strips markdown code fences from a
  JSON response — a safety net for a gateway that wraps structured output in
  ` ```json ` fences even when asked not to.

A gateway provider takes no `metadata` — it speaks a generic spec with no
per-vendor dashboard attribution to feed.
