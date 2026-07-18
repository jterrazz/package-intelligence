/**
 * Generates `src/formatting/preserved-terms.generated.ts` from cspell
 * dictionaries. Re-run with `npm run generate:terms` whenever the source
 * cspell packages (or `dictionary-en`) are bumped.
 *
 * Sources (npm devDependencies, read straight out of node_modules so the
 * script stays replayable without vendoring anything by hand):
 *  - @cspell/dict-software-terms/dict/computing-acronyms.txt (most specific)
 *  - @cspell/dict-companies/dict/companies.txt
 *  - @cspell/dict-software-terms/dict/softwareTerms.txt.gz   (least specific)
 *
 * Package-format note: unlike `companies.txt` and `computing-acronyms.txt`,
 * which ship as plain UTF-8 text, `dict-software-terms` ships its big
 * general-purpose word list pre-gzipped as `softwareTerms.txt.gz` (the
 * `software-terms.txt` name from the cspell-dicts source repo does not exist
 * as an installed artifact — see
 * https://github.com/streetsidesoftware/cspell-dicts/blob/main/dictionaries/software-terms/dict/softwareTerms.txt
 * for the pre-compression source if this ever needs to be vendored by hand).
 * We gunzip it in-memory with `node:zlib` rather than shipping a decompressed
 * copy, so nothing else about the pipeline changes.
 *
 * Ambiguity filter (the crucial step): these dictionaries list plenty of
 * terms that are ALSO ordinary English words (Apple/apple, Linear/linear,
 * Notion/notion, Google/google...). Preserving those unconditionally would
 * force-capitalize the common word too, e.g. turn "the apple orchard" into
 * "the Apple orchard". We drop any candidate whose lowercase form is a
 * genuine *lowercase* headword in `dictionary-en` (a Hunspell word list used
 * by spell-checkers) -- proper nouns that only ever appear capitalized in
 * that dictionary (GitHub, Netflix, Appleseed...) are not "common words" and
 * are kept. Concretely: dictionary-en lists both "Google/M" (proper noun)
 * and "google/DSMG" (the verb) as separate headwords, so "Google" is
 * correctly treated as ambiguous, whereas it only lists "GitHub/M" (no
 * lowercase "github" headword exists), so "GitHub" is kept.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { gunzipSync } from 'node:zlib';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(SCRIPT_DIR, '..');
const NODE_MODULES_DIR = path.join(ROOT_DIR, 'node_modules');
const OUTPUT_PATH = path.join(ROOT_DIR, 'src/formatting/preserved-terms.generated.ts');

/** Compound/prefix/suffix flag characters used by cspell word lists. */
const CSPELL_FLAG_CHARS = /[!+*~]/;
/** A single "word" entry: letters/digits plus the punctuation real terms use (Coca-Cola, 2FA, AT&T-style). */
const VALID_TERM_PATTERN = /^[A-Za-z0-9&'.-]+$/;

interface Source {
    /** Specificity rank used for dedup precedence: lower wins. */
    readonly rank: number;
    readonly label: string;
    readonly terms: readonly string[];
}

function readTextFile(relativePath: string): string {
    return readFileSync(path.join(NODE_MODULES_DIR, relativePath), 'utf8');
}

function readGzipTextFile(relativePath: string): string {
    const gz = readFileSync(path.join(NODE_MODULES_DIR, relativePath));
    return gunzipSync(gz).toString('utf8');
}

/** Single-quoted string literal, matching this repo's formatting style. */
function quote(term: string): string {
    return `'${term.replace(/\\/g, String.raw`\\`).replace(/'/g, String.raw`\'`)}'`;
}

/**
 * Filter (a): strip comments, blank lines, multi-word entries, and any
 * cspell compound/flag syntax. Filter (b): the lowercase-only entries (e.g.
 * "api", "git-commit") have nothing worth preserving, so they're dropped too.
 */
function parseWordListCandidates(raw: string): string[] {
    return raw
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line.length > 0)
        .filter((line) => !line.startsWith('#'))
        .filter((line) => !/\s/.test(line)) // (a) multi-word entries
        .filter((line) => !CSPELL_FLAG_CHARS.test(line)) // (a) cspell flag syntax
        .filter((line) => VALID_TERM_PATTERN.test(line))
        .filter((line) => /[A-Z]/.test(line)); // (b) must have a capital to preserve
}

/**
 * Builds the ambiguity set: every genuinely lowercase headword from the
 * Hunspell `dictionary-en` word list (`word/flags` per line, first line is a
 * word count). Capitalized-only headwords (proper nouns the dictionary
 * already knows about) are intentionally excluded from this set -- see the
 * module doc comment for why.
 */
function buildCommonWordSet(): Set<string> {
    const raw = readTextFile('dictionary-en/index.dic');
    const lines = raw.split('\n').slice(1); // Skip the leading word-count line
    const common = new Set<string>();
    for (const line of lines) {
        const headword = line.split('/')[0]?.trim();
        if (headword && /^[a-z]/.test(headword)) {
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

    const kept = new Map<string, string>(); // Lowercase -> canonical casing
    const excludedAsAmbiguous: { source: string; term: string }[] = [];
    let candidateCount = 0;

    // Most specific source first so it wins dedup ties (filter d).
    for (const source of [...sources].sort((a, b) => a.rank - b.rank)) {
        for (const term of source.terms) {
            candidateCount += 1;
            const lower = term.toLowerCase();

            // Filter (c): the crucial ambiguity check.
            if (commonWords.has(lower)) {
                excludedAsAmbiguous.push({ source: source.label, term });
                continue;
            }

            // Filter (d): dedup case-insensitively, first (= most specific) wins.
            if (!kept.has(lower)) {
                kept.set(lower, term);
            }
        }
    }

    const finalTerms = [...kept.values()].sort((a, b) => a.localeCompare(b));

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
