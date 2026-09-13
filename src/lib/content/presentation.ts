/**
 * The line-based fields on a module's page.
 *
 * The office types these into a textarea, one entry per line, because that is
 * the fastest thing to edit and the easiest thing to explain. The database
 * stores structured JSON, because the public page maps over it. These are the
 * two functions that convert between the two, and they are pure so the
 * conversion can be tested rather than discovered on a live page.
 *
 * Every parser here is total: whatever is in the box, it returns a valid array.
 * Blank lines vanish, a line with no separator keeps its whole text as the
 * title, and nothing ever throws — a typo in an admin textarea must not be
 * able to take down a course page.
 */

export interface Highlight {
  title: string;
  body: string;
}

export interface GalleryImage {
  url: string;
  alt: string;
}

/** Split on newlines, trim, drop the empties. */
function lines(text: string): string[] {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '');
}

/** Conditions d'accès: one bullet per line. */
export function parseBullets(text: string): string[] {
  // A leading dash is what someone types when they are writing a list. Take it
  // off rather than printing a bullet in front of a bullet.
  return lines(text)
    .map((line) => line.replace(/^[-–—•*]\s*/, ''))
    .filter((l) => l !== '');
}

export function formatBullets(items: readonly string[]): string {
  return items.join('\n');
}

/**
 * The three blocks: `Titre | texte`.
 *
 * The pipe is the separator because it is the one character nobody puts in a
 * French sentence by accident. Only the first one splits, so a body may
 * contain another.
 */
export function parseHighlights(text: string): Highlight[] {
  return lines(text).map((line) => {
    const at = line.indexOf('|');
    if (at === -1) return { title: line, body: '' };
    return { title: line.slice(0, at).trim(), body: line.slice(at + 1).trim() };
  });
}

export function formatHighlights(items: readonly Highlight[]): string {
  return items.map((h) => (h.body ? `${h.title} | ${h.body}` : h.title)).join('\n');
}

/**
 * Read back whatever the database column holds.
 *
 * `jsonb` is checked for being an array by a constraint, not for what is in it,
 * so this is where a row written by an older version — or by hand in the SQL
 * editor — is made safe to render.
 */
export function readBullets(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === 'string' && v.trim() !== '');
}

export function readHighlights(value: unknown): Highlight[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => {
      if (typeof entry === 'string') return { title: entry, body: '' };
      if (entry && typeof entry === 'object') {
        const { title, body } = entry as { title?: unknown; body?: unknown };
        return {
          title: typeof title === 'string' ? title : '',
          body: typeof body === 'string' ? body : '',
        };
      }
      return { title: '', body: '' };
    })
    .filter((h) => h.title !== '');
}

export function readGallery(value: unknown): GalleryImage[] {
  if (!Array.isArray(value)) return [];
  return (
    value
      .map((entry) => {
        if (typeof entry === 'string') return { url: entry, alt: '' };
        if (entry && typeof entry === 'object') {
          const { url, alt } = entry as { url?: unknown; alt?: unknown };
          return {
            url: typeof url === 'string' ? url : '',
            alt: typeof alt === 'string' ? alt : '',
          };
        }
        return { url: '', alt: '' };
      })
      // An entry with no URL is not an image, however it got written.
      .filter((image) => image.url.startsWith('http') || image.url.startsWith('/'))
  );
}

/**
 * On the way back into `jsonb`.
 *
 * The generated `Json` type is an index-signature shape, and a named interface
 * does not satisfy it however identical the fields are. These two say the
 * conversion out loud rather than spreading a cast over the call sites.
 */
export function highlightsToJson(items: readonly Highlight[]): Record<string, string>[] {
  return items.map((h) => ({ title: h.title, body: h.body }));
}

export function galleryToJson(items: readonly GalleryImage[]): Record<string, string>[] {
  return items.map((image) => ({ url: image.url, alt: image.alt }));
}
