/**
 * URL identifiers, derived rather than typed.
 *
 * The admin screens used to ask for an "Identifiant d'URL" next to the title
 * — a second field, in a shape most people have no reason to know, that could
 * collide with an existing one and refuse the save. The title is the only
 * thing anyone actually decides, so the slug is now worked out from it and the
 * field is gone.
 *
 * A slug is picked once, when the record is created, and then left alone: it
 * is the address students bookmark and share, so renaming a course must not
 * silently break every link to it.
 */

/** Fold accents to ASCII so "Aqīda" and "Aqida" produce the same address. */
function deaccent(input: string): string {
  return input.normalize('NFD').replace(/[̀-ͯ]/g, '');
}

/** Lower-case, hyphen-separated, nothing a URL would have to escape. */
export function slugify(input: string, maxLength = 80): string {
  return deaccent(input)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, maxLength)
    .replace(/-+$/, '');
}

/**
 * The first address in the `base`, `base-2`, `base-3`… series that nobody
 * holds yet.
 *
 * Two courses can legitimately share a title — "Année 1" under two cursus, a
 * module taught again next year — and the admin should not have to learn that
 * from a failed save. `fallback` covers a title that slugifies to nothing at
 * all, which a title written entirely in Arabic does.
 */
export function pickFreeSlug(base: string, taken: Iterable<string>, fallback = 'cours'): string {
  const stem = base || fallback;
  const used = new Set(taken);
  if (!used.has(stem)) return stem;

  for (let n = 2; n <= 999; n += 1) {
    const candidate = `${stem}-${n}`;
    if (!used.has(candidate)) return candidate;
  }
  // A thousand identical titles is not a real case; stay unique regardless.
  return `${stem}-${Date.now().toString(36)}`;
}
