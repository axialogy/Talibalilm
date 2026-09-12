/**
 * Object keys for the slide bucket.
 *
 * Pure, and separated from the client that signs URLs, because the shape of a
 * key is a security rule rather than a storage detail: the database has a CHECK
 * constraint demanding exactly this pattern, so a key built here and a key the
 * table will accept cannot drift apart without a test failing.
 *
 * The name is random, not the uploader's filename. A filename arrives from a
 * browser and may contain anything at all — path separators, `..`, control
 * characters, a name that collides with someone else's slide. None of that can
 * reach the bucket if the bucket never sees it: the original is kept in a
 * column, for display only, and the object is filed under bytes we chose.
 */

/** Mirrors `live_slides_key_owned` in the migration. Keep the two in step. */
export const SLIDE_KEY_PATTERN = /^live\/[0-9a-f-]{36}\/[A-Za-z0-9_-]{8,64}\.(png|jpg|webp)$/;

export type SlideExtension = 'png' | 'jpg' | 'webp';

/**
 * Where one slide lives: `live/<session id>/<random>.<ext>`.
 *
 * The session id is the prefix, which is what makes a cross-class read
 * impossible to construct rather than merely refused — there is no key naming
 * another class's object that this session's row would be allowed to hold.
 */
export function slideKey(sessionId: string, extension: SlideExtension, random: string): string {
  return `live/${sessionId}/${random}.${extension}`;
}

/** 16 URL-safe bytes of randomness, for the object's name. */
export function slideName(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Is this a key we issued for this session?
 *
 * Every action that takes a key from the browser runs it through here before
 * anything else, so a caller cannot reach sideways into another class's prefix
 * or escape the bucket layout by sending `..`. The database refuses the same
 * thing independently; this is the cheaper of the two refusals, not the only.
 */
export function isSlideKeyFor(key: string, sessionId: string): boolean {
  return SLIDE_KEY_PATTERN.test(key) && key.startsWith(`live/${sessionId}/`);
}

/** The filename kept for display: no path, no control characters, bounded. */
export function safeFilename(raw: string): string {
  const base = raw.split(/[\\/]/).pop() ?? '';
  return base
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .trim()
    .slice(0, 120);
}
