import { NextIntlClientProvider } from 'next-intl';
import { getMessages, setRequestLocale } from 'next-intl/server';
import { SiteHeader } from '@/components/layout/SiteHeader';
import { SiteFooter } from '@/components/layout/SiteFooter';
import { logoLockupSrc } from '@/lib/artwork';
import { clientMessages } from '@/i18n/client-messages';

/**
 * The public site: header, page, footer.
 *
 * A route group, so it wraps everything a visitor sees without appearing in
 * any URL. `/admin` sits outside it and gets its own shell instead — an
 * administration panel with a shop's navigation bolted above it is neither.
 *
 * The message catalogue is trimmed here rather than in the root layout,
 * because the admin subtree needs a different slice of it.
 */
export default async function SiteLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const messages = await getMessages();

  return (
    <NextIntlClientProvider messages={clientMessages(messages)}>
      <SiteHeader logoSrc={logoLockupSrc()} />
      <main id="main" className="flex-1">
        {children}
      </main>
      <SiteFooter />
    </NextIntlClientProvider>
  );
}
