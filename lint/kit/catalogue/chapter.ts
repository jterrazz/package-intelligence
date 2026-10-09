import { anchor, cell, markdownTable } from '@jterrazz/typescript/rules';
import type { RuleDocs } from '@jterrazz/typescript/rules';

type Row = RuleDocs & { why: string };

/** The catalogue as its chapter shows it: one section per family, in the order given, each rule a row its lessons read. */
export function catalogueBody(
    rows: readonly Row[],
    families: Readonly<Record<string, string>>,
): string {
    return Object.entries(families)
        .map(([family, title]) =>
            [
                `### ${title}`,
                '',
                markdownTable(
                    ['Rule', 'Holds', 'Why', 'Fix'],
                    rows
                        .filter((row) => row.family === family)
                        .map((row) => [
                            `${anchor(row.name)}\`${row.name}\``,
                            cell(row.sentence),
                            cell(row.why),
                            cell(row.fix),
                        ]),
                ),
            ].join('\n'),
        )
        .join('\n\n');
}
