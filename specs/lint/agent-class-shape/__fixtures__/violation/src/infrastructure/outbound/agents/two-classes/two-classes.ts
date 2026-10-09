import { buildPrompt } from './two-classes.prompt.js';

export class TwoClasses {
    static readonly SCHEMA = {};

    constructor(private readonly model: unknown) {}

    run(): string {
        return buildPrompt();
    }
}

export class Helper {}
