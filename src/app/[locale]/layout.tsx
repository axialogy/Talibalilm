import { hasLocale } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { routing, directionOf, type Locale } from '@/i18n/routing';
import { siteUrl } from '@/lib/env';
import '../globals.css';

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();

  const t = await getTranslations({ locale, namespace: 'meta' });
  const base = siteUrl();

  return {
    metadataBase: new URL(base),
    title: {
      default: `${t('siteName')} — ${t('tagline')}`,
      template: `%s — ${t('siteName')}`,
    },
    description: t('defaultDescription'),
    // Both locales are declared to search engines, so an English-speaking
    // visitor is not served the French page and vice versa.
    alternates: {
      canonical: locale === routing.defaultLocale ? '/' : `/${locale}`,
      languages: { fr: '/', en: '/en' },
    },
    openGraph: {
      type: 'website',
      siteName: t('siteName'),
      title: `${t('siteName')} — ${t('tagline')}`,
      description: t('defaultDescription'),
      locale: locale === 'en' ? 'en_GB' : 'fr_FR',
      images: [{ url: '/branding/og.png', width: 1200, height: 630 }],
    },
    twitter: { card: 'summary_large_image' },
    // The favicon and Apple icon come from src/app/icon.png and
    // src/app/apple-icon.png (Next's file convention), generated from the
    // school's own mark — so they are not restated here. The manifest carries
    // the PWA icons.
    manifest: '/manifest.webmanifest',
  };
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();

  // Opts this subtree into static rendering; without it every page under
  // [locale] is forced dynamic and the ISR the spec asks for never happens.
  setRequestLocale(locale);

  const typed = locale as Locale;

  // Deliberately thin: `<html>`, the fonts and the metadata, nothing else.
  // The marketing header and footer belong to the (site) group, so the admin
  // panel can be a panel rather than a page wearing a shop's chrome.
  return (
    <html lang={typed} dir={directionOf(typed)} suppressHydrationWarning>
      <body className="flex min-h-screen flex-col">{children}</body>
    </html>
  );
}
