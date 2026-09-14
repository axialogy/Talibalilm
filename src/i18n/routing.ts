import { hasLocale } from 'next-intl';
import { defineRouting } from 'next-intl/routing';

/**
 * French is the default and is not prefixed — the school is in France and the
 * bulk of traffic reads French, so `/` and `/courses` stay clean. English lives
 * under `/en`.
 */
export const routing = defineRouting({
  locales: ['fr', 'en'],
  defaultLocale: 'fr',
  localePrefix: 'as-needed',
});

export type Locale = (typeof routing.locales)[number];

/**
 * A locale that came from somewhere untrusted, made safe to hand to `Intl`.
 *
 * The `[locale]` segment matches any string, so a path the middleware skipped
 * — anything containing a dot, such as the `/wp-login.php` a scanner asks for
 * — reaches a page as `locale = "wp-login.php"`. `notFound()` in the layout is
 * meant to answer that, but layouts and pages render in parallel, so a page
 * that calls `new Intl.DateTimeFormat(locale)` throws a RangeError before the
 * 404 can resolve and the visitor is shown a crash instead. That fault was in
 * the production log, once per scanner request.
 *
 * `hasLocale` is the same check the layout and the request config already
 * make. This is that check in one place, for the code that hands the value to
 * `Intl`.
 */
export function safeLocale(value: unknown): Locale {
  return hasLocale(routing.locales, value) ? value : routing.defaultLocale;
}

/**
 * Both interface locales are left-to-right today. The function stays because
 * it is the one place that decides, and because Arabic course titles are still
 * printed on the cover art — those carry their own `dir` on the element rather
 * than flipping the page.
 */
export function directionOf(_locale: Locale): 'ltr' | 'rtl' {
  return 'ltr';
}

export const localeLabels: Record<Locale, string> = {
  fr: 'Français',
  en: 'English',
};
