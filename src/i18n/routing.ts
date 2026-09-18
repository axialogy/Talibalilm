import { hasLocale } from 'next-intl';
import { notFound } from 'next/navigation';
import { defineRouting } from 'next-intl/routing';

/**
 * French is the default and is not prefixed — the school is in France and the
 * bulk of traffic reads French, so `/` and `/courses` stay clean. English lives
 * under `/en`.
 *
 * `localeDetection: false` is deliberate. next-intl otherwise reads the
 * browser's Accept-Language header and silently redirects an English-configured
 * browser from `/` to `/en` — a visitor following a link the school published
 * would land in English without asking. The first language is French for
 * everyone; English is only reached through the language switcher or `/en`.
 */
export const routing = defineRouting({
  locales: ['fr', 'en'],
  defaultLocale: 'fr',
  localePrefix: 'as-needed',
  localeDetection: false,
});

export type Locale = (typeof routing.locales)[number];

/**
 * The locale from the URL, or a 404.
 *
 * This exists because a LAYOUT DOES NOT STOP ITS PAGE. A request whose first
 * segment is not a locale — a bot probing `/wp-admin`, a stale link, a typo —
 * reaches `app/[locale]/…` with that segment as the locale, and Next renders
 * the layout and the page in PARALLEL: `notFound()` in `[locale]/layout.tsx`
 * does not prevent the page from running. The page then formatted a date with
 * `Intl.DateTimeFormat('wp-admin')` and threw `RangeError: Incorrect locale
 * information provided` — a 500, on every probe, for hours. The layout's check
 * was real; it was just too late.
 *
 * So every page under `[locale]` calls this before it renders anything. The
 * cost is one line; the alternative is serving 500s to strangers and to search
 * engines that should have been told 404.
 */
export function requireLocale(value: string): Locale {
  if (!hasLocale(routing.locales, value)) notFound();
  return value;
}

/**
 * A locale Intl will accept, for the formatting helpers.
 *
 * The guard above is the control; this is the belt. `Intl.DateTimeFormat` and
 * `NumberFormat` throw on a tag they do not recognise, and a formatting call
 * deep inside a component is a poor place to discover that — so an unknown tag
 * degrades to the default language rather than taking the page down.
 */
export function safeLocale(value: string | undefined | null): Locale {
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
