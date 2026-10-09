import type { IntelligenceConfig } from '../../../src/index.js';

export const GATEWAY_COMPLETIONS = 'http://gateway.test/v1/chat/completions';

export const OPENROUTER_COMPLETIONS = 'https://openrouter.ai/api/v1/chat/completions';

/** The two providers a configuration names: a gateway by its base URL, and OpenRouter with its attribution. */
export const PROVIDERS: IntelligenceConfig['providers'] = {
    gateway: { apiKey: 'gateway-key', baseURL: 'http://gateway.test/v1', type: 'gateway' },
    router: {
        apiKey: 'router-key',
        metadata: { application: 'Signews', website: 'https://signews.test' },
        type: 'openrouter',
    },
};
