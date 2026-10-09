import { buildPrompt } from './no-constructor.prompt.js';

export class NoConstructor {
    static readonly SCHEMA = {};

    run(): string {
        return buildPrompt();
    }
}
