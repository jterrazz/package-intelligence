import {
    createCostMiddleware,
    createFallbackModel,
    createIntelligence,
    createLoggingMiddleware,
    createSchemaInstructionMiddleware,
} from '@jterrazz/intelligence';
import type { AgentConfig, Intelligence, IntelligenceConfig } from '@jterrazz/intelligence';
import { cleanAiText, toSentenceCase } from '@jterrazz/intelligence/formatting';
import type { LanguageModel, LanguageModelMiddleware } from 'ai';

const summarizer: AgentConfig = {
    fallback: { model: 'fallback-model', provider: 'router' },
    model: 'primary-model',
    provider: 'gateway',
};

const config: IntelligenceConfig = {
    agents: { summarizer },
    pricing: { 'gateway/primary-model': { input: 3, output: 15 } },
    providers: {
        gateway: { apiKey: 'key', baseURL: 'http://gateway.test/v1', type: 'gateway' },
        router: { apiKey: 'key', type: 'openrouter' },
    },
};

const intelligence: Intelligence = createIntelligence(config);
const model: LanguageModel = intelligence.model('summarizer');
const answered: LanguageModel = createFallbackModel({ fallback: model, primary: model });
const middleware: LanguageModelMiddleware[] = [
    createCostMiddleware({ pricing: { input: 3, output: 15 } }),
    createSchemaInstructionMiddleware(),
];
const title: string = toSentenceCase(cleanAiText('A Title'));

// @ts-expect-error -- a provider type the factory does not know is refused
const unknown: IntelligenceConfig = { agents: {}, providers: { x: { apiKey: 'key', type: 'bedrock' } } };

// @ts-expect-error -- the logging middleware needs the logger it writes to
createLoggingMiddleware({});

export { answered, middleware, title, unknown };
