import { getMessages, getTranslations, setRequestLocale } from 'next-intl/server';
import { NextIntlClientProvider } from 'next-intl';
import { adminClientMessages } from '@/i18n/client-messages';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { AdminShell } from '@/components/admin/AdminShell';
import { requireStaff } from '@/lib/auth/guards';
import { supabaseConfigured } from '@/lib/env';

export const metadata: Metadata = { robots: { index: false, follow: false } };

/**
 * Staff chrome.
 *
 * The guard here keeps a student from *seeing* the screens. What keeps them
 * from changing anything is the `is_staff()` policy on every table
 * underneath, which holds even if this layout is bypassed entirely.
 */
export default async function AdminLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  if (!supabaseConfigured) redirect('/login');
  const viewer = await requireStaff();
  const t = await getTranslations('admin');
  const messages = await getMessages();

  return (
    <NextIntlClientProvider messages={adminClientMessages(messages)}>
      <AdminShell
        name={viewer.fullName || viewer.email || ''}
        role={viewer.role}
        isAdmin={viewer.role === 'admin'}
        title={t('title')}
      >
        {children}
      </AdminShell>
    </NextIntlClientProvider>
  );
}
