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
