import { createIntelligence } from '@jterrazz/intelligence';

const intelligence = createIntelligence({ agents: {}, providers: {} });

export const model = intelligence.model('summarizer');
