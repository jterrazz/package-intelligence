export class Unprompted {
    static readonly SCHEMA = {};

    constructor(private readonly model: unknown) {}

    run(): string {
        return 'Summarize.';
    }
}
