import type { RuleDoc } from './types.js';

/**
 * The rule manifest — the single source of truth for the mechanized
 * agent/prompt conventions catalogue (mirrors `@jterrazz/test`'s
 * `src/lint/manifest.ts` docs-as-code inversion: the normative text lives
 * NEXT TO the rule it documents, attached as `meta.docs`, instead of drifting
 * apart in a hand-maintained doc).
 *
 * The README's "Agent & prompt conventions" section is the human-facing
 * explanation of *why* this shape exists; this manifest is the machine-facing
 * "what exactly is checked" — `plugin.test.ts` asserts every shipped rule
 * carries its entry and that no entry is orphaned.
 */
export const RULE_DOCS: Record<string, RuleDoc> = {
    'g1-agent-class-shape': {
        id: 'G1',
        convention:
            'An agent file (`agents/<name>/<name>.ts`) exports exactly one class; that class has a `static readonly SCHEMA` member, a `run` method, and a constructor whose first parameter is named `model`.',
        rationale:
            'A fixed shape makes every agent class predictable to read and to wire up from a DI container without re-deriving its contract each time.',
    },
    'm1-model-resolution-in-container': {
        id: 'M1',
        convention:
            "Calls to `createIntelligence(...)`, `createGatewayProvider(...)`, `createOpenRouterProvider(...)`, and `.model('…')` on the value they produce, are only allowed in a file whose path contains `/di/` or whose name ends in `container.ts`.",
        rationale:
            'Model resolution is composition-root work — scattering it lets a provider/model choice drift outside the one place meant to own it.',
    },
    'm2w-no-hardcoded-model-id': {
        id: 'M2',
        convention:
            'A string literal that looks like a model id (`claude-…`, `openai/gpt-…`, …) outside config/test/fixture/spec files is a warning — model ids belong in configuration.',
        rationale:
            'A model id inlined in application code can only change by a code deploy; configuration lets it change without one.',
    },
    'p1-prose-in-prompt-files': {
        id: 'P1',
        convention:
            'In any file under an `agents/` folder that is not a `*.prompt.ts` (nor a `*.test.ts`), a template literal spanning 3+ lines that reads as natural-language prose (a line with 4+ space-separated words, or a markdown heading) is an error — move it to the sibling `*.prompt.ts`.',
        rationale:
            'The agent class only shapes data; prose that leaks into it hides the actual prompt contract and makes the two impossible to review independently.',
    },
    'p2-prompt-file-exports': {
        id: 'P2',
        convention:
            'A `*.prompt.ts` file exports only const arrow functions returning a string, plus types/interfaces — no default export, no class, no non-function const.',
        rationale:
            'A closed export surface keeps a prompt file a pure builder module — anything else (state, a class, a default export) would invite prompt logic to grow side effects.',
    },
    'p3-agent-prompt-sibling': {
        id: 'P3',
        convention:
            'An agent file (`agents/<name>/<name>.ts`) imports its prompt from `./<name>.prompt.js`; a `<name>.prompt.ts` file outside `_shared/` has a sibling `<name>.ts` in the same directory.',
        rationale:
            "The two-way link is what makes the pairing mechanical instead of a naming convention nobody enforces — an orphaned prompt file, or an agent that silently doesn't use its prompt, is almost always a mistake.",
    },
};
