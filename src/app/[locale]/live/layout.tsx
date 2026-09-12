import { NextIntlClientProvider } from 'next-intl';
import { getMessages, setRequestLocale } from 'next-intl/server';
import { clientMessages } from '@/i18n/client-messages';

/**
 * The classroom's own shell.
 *
 * It exists because this route sits outside both `(site)` and `admin`, and
 * those are where `NextIntlClientProvider` was mounted — so the room rendered
 * with no message context at all and `useTranslations` threw the moment the
 * Classroom hydrated. A blank page with a client-side exception, from code that
 * was correct on the server.
 *
 * There is deliberately no header, footer or sidebar: a class fills the screen,
 * and every pixel of site chrome is a pixel not showing the teacher.
 */
export default async function LiveLayout({
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
      <main id="main" className="flex-1">
        {children}
      </main>
    </NextIntlClientProvider>
  );
}
