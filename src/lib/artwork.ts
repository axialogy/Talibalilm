import { existsSync } from 'node:fs';
import path from 'node:path';

/**
 * Pick the first artwork file that actually exists under `public/`.
 *
 * The institute's real logo is a raster file they will drop in later; until
 * then an SVG placeholder stands in. Resolving that on the *server* matters:
 * the obvious alternative — an `<img onError>` that swaps source on 404 —
 * loses the race. The browser requests the image while parsing the SSR HTML,
 * the error fires before React has hydrated and attached the handler, and the
 * visitor is left looking at a broken-image icon.
 *
 * Runs at build time for statically generated pages, so adding the real file
 * and redeploying is the whole handover.
 */
const PUBLIC_DIR = path.join(process.cwd(), 'public');
const cache = new Map<string, string>();

export function resolveArtwork(...candidates: string[]): string {
  const key = candidates.join('|');
  const hit = cache.get(key);
  if (hit !== undefined) return hit;

  const found =
    candidates.find((candidate) => existsSync(path.join(PUBLIC_DIR, candidate.replace(/^\//, '')))) ??
    candidates[candidates.length - 1] ??
    '';

  cache.set(key, found);
  return found;
}

/** The full lockup: calligraphy over the wordmark. */
export function logoLockupSrc(): string {
  return resolveArtwork('/branding/logo-institut.png', '/branding/logo-institut.svg');
}

/** The square mark, for favicons and tight slots. */
export function logoMarkSrc(): string {
  return resolveArtwork('/branding/logo-mark.png', '/branding/logo-mark.svg');
}
