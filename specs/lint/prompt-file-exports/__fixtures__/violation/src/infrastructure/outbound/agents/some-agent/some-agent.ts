import { buildPrompt } from './some-agent.prompt.js';

export class SomeAgent {
    static readonly SCHEMA = {};

    constructor(private readonly model: unknown) {}

    run(): string {
        return buildPrompt('world');
    }
}
