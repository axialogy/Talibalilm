import { describe, expect, it } from 'vitest';
import { requireLocale, safeLocale } from '@/i18n/routing';

/**
 * The guard that stops a bot's URL from becoming a 500.
 *
 * A layout does not stop its page: `notFound()` in `[locale]/layout.tsx` left
 * the page running, and `Intl.DateTimeFormat('wp-admin')` threw. Every page
 * under `[locale]` now asks this first.
 */

describe('requireLocale', () => {
  it('returns a locale it knows', () => {
    expect(requireLocale('fr')).toBe('fr');
    expect(requireLocale('en')).toBe('en');
  });

  it('stops anything else', () => {
    // `notFound()` throws Next's own marker, which the framework turns into a
    // 404 — that is the whole point: no render, no formatting, no 500.
    for (const bad of ['wp-admin', 'xmlrpc', '', 'fr_FR', 'undefined']) {
      expect(() => requireLocale(bad)).toThrow();
    }
  });
});

describe('safeLocale', () => {
  it('passes a known locale through', () => {
    expect(safeLocale('en')).toBe('en');
  });

  it('falls back to French rather than throwing', () => {
    // The belt behind the guard: a formatter handed a bad tag must degrade,
    // not take the page down.
    expect(safeLocale('wp-admin')).toBe('fr');
    expect(safeLocale('')).toBe('fr');
    expect(safeLocale(undefined)).toBe('fr');
    expect(safeLocale(null)).toBe('fr');
  });
});
