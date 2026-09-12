/**
 * Tidy what the office types into a batch name.
 *
 * These used to be validated with a regex and rejected. Someone naming a batch
 * "October 2026" — the obvious thing to type — got a red sentence next to the
 * Generate button telling them about lower-case letters and hyphens, with no
 * indication of which of the two fields it meant. The rule was also wrong: the
 * pattern was case-insensitive, so capitals were fine all along and only the
 * space was the problem.
 *
 * Normalising is the better contract. There is nothing the office could mean by
 * "October 2026" other than the batch called october-2026, so the form takes
 * the words and does the punctuation itself.
 */

/** Fold accents down to ASCII so "Été" and "Ete" name the same batch. */
function deaccent(input: string): string {
  return input.normalize('NFD').replace(/[̀-ͯ]/g, '');
}

/**
 * A batch label: lower-case, hyphen-separated, safe to put in a URL and to
 * compare by eye on a CSV the accountant is reading.
 */
export function slugifyBatch(input: string): string {
  return deaccent(input)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    .replace(/-+$/, '');
}
