import { describe, expect, it } from 'vitest';
import { routing, safeLocale } from '@/i18n/routing';

/**
 * The `[locale]` segment matches any string, and the middleware skips any path
 * with a dot in it — so a scanner asking for `/wp-login.php` reached the home
 * page as `locale = "wp-login.php"`. `notFound()` in the layout was meant to
 * answer that, but layouts and pages render in parallel: the page threw first.
 * The production log had the RangeError once per scanner request.
 */
describe('safeLocale', () => {
  it('keeps a supported locale', () => {
    expect(safeLocale('fr')).toBe('fr');
    expect(safeLocale('en')).toBe('en');
  });

  it('falls back to the default for the segment a bot asks for', () => {
    expect(safeLocale('wp-login.php')).toBe(routing.defaultLocale);
    expect(safeLocale('sitemap.xml')).toBe(routing.defaultLocale);
    expect(safeLocale('de')).toBe(routing.defaultLocale);
  });

  it('falls back for empty and non-string values', () => {
    expect(safeLocale('')).toBe(routing.defaultLocale);
    expect(safeLocale(null)).toBe(routing.defaultLocale);
    expect(safeLocale(undefined)).toBe(routing.defaultLocale);
    expect(safeLocale(42)).toBe(routing.defaultLocale);
  });

  it('is exactly what makes the DateTimeFormat call survive', () => {
    // The regression itself: this is the call EventsSection makes, and the
    // reason the helper exists.
    expect(() => new Intl.DateTimeFormat('wp-login.php')).toThrow(RangeError);
    expect(() => new Intl.DateTimeFormat(safeLocale('wp-login.php'))).not.toThrow();
  });
});
