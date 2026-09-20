import { buildPrompt } from './bad-agent.prompt.js';

export class BadAgent {
    static readonly SCHEMA = {};

    private readonly client: unknown;

    constructor(client: unknown) {
        this.client = client;
    }

    run(): string {
        return buildPrompt();
    }
}
