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

// A lowercase headword marks a common word: preserving a term that collides with one would capitalize the word too.
function buildCommonWordSet(): Set<string> {
    const raw = readTextFile('dictionary-en/index.dic');
    // The first line of a Hunspell .dic is the word count, not a headword.
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

function main(): void {
    const commonWords = buildCommonWordSet();

    const sources: Source[] = [
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

    const canonicalByLowercase = new Map<string, string>();
    const excludedAsAmbiguous: { source: string; term: string }[] = [];
    let candidateCount = 0;

    // Most specific source first: it wins a case-insensitive tie.
    for (const source of sources.toSorted((a, b) => a.rank - b.rank)) {
        for (const term of source.terms) {
            candidateCount += 1;
            const lower = term.toLowerCase();
            if (commonWords.has(lower)) {
                excludedAsAmbiguous.push({ source: source.label, term });
                continue;
            }
            if (!canonicalByLowercase.has(lower)) {
                canonicalByLowercase.set(lower, term);
            }
        }
    }

    const finalTerms = [...canonicalByLowercase.values()].toSorted((a, b) => a.localeCompare(b));

    const exampleExclusions = excludedAsAmbiguous.slice(0, 12).map(({ source, term }) => {
        const lower = term.toLowerCase();
        return `${term} -> "${lower}" (${source})`;
    });

    const header = `/**
 * GENERATED FILE — do not edit, run \`npm run generate:terms\`.
 *
 * Source: @cspell/dict-companies + @cspell/dict-software-terms, filtered
 * through the \`dictionary-en\` ambiguity check (see
 * scripts/generate-preserved-terms.ts for the full pipeline).
 *
 * Candidates before ambiguity filter: ${candidateCount}
 * Excluded as ambiguous (lowercase form is a common English word): ${excludedAsAmbiguous.length}
 * Kept: ${finalTerms.length}
 *
 * Examples of ambiguity exclusions:
${exampleExclusions.map((line) => ` *   ${line}`).join('\n')}
 */

export const GENERATED_PRESERVED_TERMS: readonly string[] = [
${finalTerms.map((term) => `    ${quote(term)},`).join('\n')}
];
`;

    writeFileSync(OUTPUT_PATH, header);

    console.log(
        `Wrote ${finalTerms.length} preserved terms to ${path.relative(ROOT_DIR, OUTPUT_PATH)}`,
    );
    console.log(`  candidates before ambiguity filter: ${candidateCount}`);
    console.log(`  excluded as ambiguous: ${excludedAsAmbiguous.length}`);
    console.log('  examples:');
    for (const line of exampleExclusions) {
        console.log(`    ${line}`);
    }
}

main();
