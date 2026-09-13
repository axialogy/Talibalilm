import { NextIntlClientProvider } from 'next-intl';
import { getMessages, setRequestLocale } from 'next-intl/server';
import { AnnouncementBar } from '@/components/layout/AnnouncementBar';
import { SiteHeader } from '@/components/layout/SiteHeader';
import { SiteFooter } from '@/components/layout/SiteFooter';
import { logoLockupSrc } from '@/lib/artwork';
import { clientMessages } from '@/i18n/client-messages';
import { getSiteSettings } from '@/lib/data/site';

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

  // Cached and session-free, so one public row does not opt every page
  // underneath this layout out of static rendering. See `@/lib/data/site`.
  const settings = await getSiteSettings();

  return (
    <NextIntlClientProvider messages={clientMessages(messages)}>
      {settings.announcementEnabled && (
        <AnnouncementBar
          text={settings.announcementText}
          href={settings.announcementHref || undefined}
        />
      )}
      <SiteHeader logoSrc={logoLockupSrc()} />
      <main id="main" className="flex-1">
        {children}
      </main>
      <SiteFooter />
    </NextIntlClientProvider>
  );
}
