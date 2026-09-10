import { defineRouting } from 'next-intl/routing';

/**
 * French is the default and is not prefixed — the school is in France and the
 * bulk of traffic reads French, so `/` and `/courses` stay clean. Arabic lives
 * under `/ar`.
 */
export const routing = defineRouting({
  locales: ['fr', 'ar'],
  defaultLocale: 'fr',
  localePrefix: 'as-needed',
});

export type Locale = (typeof routing.locales)[number];

/** Arabic is the only RTL locale today; this is the one place that decides. */
export function directionOf(locale: Locale): 'ltr' | 'rtl' {
  return locale === 'ar' ? 'rtl' : 'ltr';
}

export const localeLabels: Record<Locale, string> = {
  fr: 'Français',
  ar: 'العربية',
};
