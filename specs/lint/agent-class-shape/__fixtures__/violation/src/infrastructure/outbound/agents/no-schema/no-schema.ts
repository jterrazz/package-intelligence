import { buildPrompt } from './no-schema.prompt.js';

export class NoSchema {
    readonly SCHEMA = {};

    constructor(private readonly model: unknown) {}

    run(): string {
        return buildPrompt();
    }
}
