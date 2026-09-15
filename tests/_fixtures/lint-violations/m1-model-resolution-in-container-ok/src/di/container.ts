import { createIntelligence } from '@jterrazz/intelligence';

export const intelligence = createIntelligence({ agents: {}, providers: {} });

export const summarizerModel = intelligence.model('summarizer');
