import { buildPrompt } from './good-agent.prompt.js';

export class GoodAgent {
    static readonly SCHEMA = {};

    private readonly model: unknown;

    constructor(model: unknown) {
        this.model = model;
    }

    run(): string {
        return buildPrompt({ topic: 'demo' });
    }
}
