import { buildPrompt } from './no-run.prompt.js';

export class NoRun {
    static readonly SCHEMA = {};

    constructor(private readonly model: unknown) {}

    execute(): string {
        return buildPrompt();
    }
}
