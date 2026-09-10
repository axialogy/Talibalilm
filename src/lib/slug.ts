/**
 * URL-safe slug from a product or post title. Latin text is transliterated
 * down to a-z0-9; Arabic-only titles produce an empty string, so callers
 * fall back to an id-based slug.
 */
export function slugify(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // strip diacritics
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

/** Slug that is guaranteed non-empty and unique against `existing`. */
export function uniqueSlug(title: string, fallbackId: string, existing: string[]): string {
  const base = slugify(title) || slugify(fallbackId) || 'item';
  if (!existing.includes(base)) return base;
  let n = 2;
  while (existing.includes(`${base}-${n}`)) n++;
  return `${base}-${n}`;
}
