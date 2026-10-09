import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { gunzipSync } from 'node:zlib';

const SCRIPT_DIR = import.meta.dirname;
const ROOT_DIR = path.resolve(SCRIPT_DIR, '..');
const NODE_MODULES_DIR = path.join(ROOT_DIR, 'node_modules');
const OUTPUT_PATH = path.join(ROOT_DIR, 'src/formatting/preserved-terms.generated.ts');

const CSPELL_FLAG_CHARS = /[!+*~]/u;
const VALID_TERM_PATTERN = /^[A-Za-z0-9&'.-]+$/u;

type Source = {
    readonly rank: number;
    readonly label: string;
    readonly terms: readonly string[];
};

function readTextFile(relativePath: string): string {
    return readFileSync(path.join(NODE_MODULES_DIR, relativePath), 'utf8');
}

function readGzipTextFile(relativePath: string): string {
    const gz = readFileSync(path.join(NODE_MODULES_DIR, relativePath));
    return gunzipSync(gz).toString('utf8');
}

function quote(term: string): string {
    return `'${term.replaceAll('\\', String.raw`\\`).replaceAll("'", String.raw`\'`)}'`;
}

function parseWordListCandidates(raw: string): string[] {
    return raw
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line.length > 0)
        .filter((line) => !line.startsWith('#'))
        .filter((line) => !/\s/u.test(line))
        .filter((line) => !CSPELL_FLAG_CHARS.test(line))
        .filter((line) => VALID_TERM_PATTERN.test(line))
        .filter((line) => /[A-Z]/u.test(line));
}

// outside: a lowercase Hunspell headword marks a common word, and preserving a term that collides with one would capitalize the word too.
function buildCommonWordSet(): Set<string> {
    const raw = readTextFile('dictionary-en/index.dic');
    // outside: the first line of a Hunspell .dic is the word count, not a headword.
    const lines = raw.split('\n').slice(1);
    const common = new Set<string>();
    for (const line of lines) {
        const headword = line.split('/')[0]?.trim();
        if (headword !== undefined && /^[a-z]/u.test(headword)) {
            common.add(headword.toLowerCase());
        }
    }
    return common;
}

function readSources(): Source[] {
    return [
        {
            label: 'computing-acronyms.txt',
            rank: 0,
            terms: parseWordListCandidates(
                readTextFile('@cspell/dict-software-terms/dict/computing-acronyms.txt'),
            ),
        },
        {
            label: 'companies.txt',
            rank: 1,
            terms: parseWordListCandidates(
                readTextFile('@cspell/dict-companies/dict/companies.txt'),
            ),
        },
        {
            label: 'softwareTerms.txt.gz',
            rank: 2,
            terms: parseWordListCandidates(
                readGzipTextFile('@cspell/dict-software-terms/dict/softwareTerms.txt.gz'),
            ),
        },
    ];
}

type Selection = {
    candidateCount: number;
    excluded: { source: string; term: string }[];
    terms: string[];
};

function selectTerms(sources: Source[], commonWords: Set<string>): Selection {
    const canonicalByLowercase = new Map<string, string>();
    const excluded: Selection['excluded'] = [];
    let candidateCount = 0;
    // invariant: the most specific source first, so it wins a case-insensitive tie.
    for (const source of sources.toSorted((a, b) => a.rank - b.rank)) {
        for (const term of source.terms) {
            candidateCount += 1;
            const lower = term.toLowerCase();
            if (commonWords.has(lower)) {
                excluded.push({ source: source.label, term });
            } else if (!canonicalByLowercase.has(lower)) {
                canonicalByLowercase.set(lower, term);
            }
        }
    }
    const terms = [...canonicalByLowercase.values()].toSorted((a, b) => a.localeCompare(b));
    return { candidateCount, excluded, terms };
}

function render({ candidateCount, excluded, terms }: Selection, examples: string[]): string {
    return `// value: written by \`npm run generate:terms\` from @cspell/dict-companies and @cspell/dict-software-terms, less every term dictionary-en holds as a common lowercase word — ${candidateCount} candidates, ${excluded.length} excluded (${examples.join('; ')}), ${terms.length} kept.

/** The proper nouns and acronyms \`toSentenceCase\` keeps as written. */
export const GENERATED_PRESERVED_TERMS: readonly string[] = [
${terms.map((term) => `    ${quote(term)},`).join('\n')}
];
`;
}

function main(): void {
    const selection = selectTerms(readSources(), buildCommonWordSet());
    const examples = selection.excluded
        .slice(0, 12)
        .map(({ source, term }) => `${term} -> "${term.toLowerCase()}" (${source})`);
    writeFileSync(OUTPUT_PATH, render(selection, examples));
    process.stdout.write(
        [
            `Wrote ${selection.terms.length} preserved terms to ${path.relative(ROOT_DIR, OUTPUT_PATH)}`,
            `  candidates before ambiguity filter: ${selection.candidateCount}`,
            `  excluded as ambiguous: ${selection.excluded.length}`,
            '  examples:',
            ...examples.map((line) => `    ${line}`),
            '',
        ].join('\n'),
    );
}

main();
