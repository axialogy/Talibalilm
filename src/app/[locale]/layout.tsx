import { NextIntlClientProvider, hasLocale } from 'next-intl';
import { getMessages } from 'next-intl/server';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { routing, directionOf, type Locale } from '@/i18n/routing';
import { SiteHeader } from '@/components/layout/SiteHeader';
import { SiteFooter } from '@/components/layout/SiteFooter';
import { siteUrl } from '@/lib/env';
import { logoLockupSrc } from '@/lib/artwork';
import { clientMessages } from '@/i18n/client-messages';
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
    icons: {
      icon: [{ url: '/branding/logo-mark.svg', type: 'image/svg+xml' }],
      apple: '/branding/apple-touch-icon.png',
    },
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
  const messages = await getMessages();

  return (
    <html lang={typed} dir={directionOf(typed)} suppressHydrationWarning>
      <body className="flex min-h-screen flex-col">
        <NextIntlClientProvider messages={clientMessages(messages)}>
          <SiteHeader logoSrc={logoLockupSrc()} />
          <main id="main" className="flex-1">
            {children}
          </main>
          <SiteFooter />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
