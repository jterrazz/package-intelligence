export class ProseyAgent {
    static readonly SCHEMA = {};

    private readonly model: unknown;

    constructor(model: unknown) {
        this.model = model;
    }

    run(): string {
        const prompt = `You are a careful assistant.
Write a concise, neutral summary of the article.
Avoid any speculation or bias.`;
        return prompt;
    }
}
