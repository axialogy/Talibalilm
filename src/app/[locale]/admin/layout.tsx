import { getMessages, getTranslations, setRequestLocale } from 'next-intl/server';
import { NextIntlClientProvider } from 'next-intl';
import { adminClientMessages } from '@/i18n/client-messages';
import type { Metadata } from 'next';
import { BookOpen, CreditCard, GraduationCap, LayoutDashboard, Tag, Wallet } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { requireStaff } from '@/lib/auth/guards';
import { supabaseConfigured } from '@/lib/env';
import { redirect } from 'next/navigation';

export const metadata: Metadata = { robots: { index: false, follow: false } };

/**
 * Staff chrome.
 *
 * The guard here keeps a student from *seeing* the screens. What keeps them
 * from changing anything is the `is_staff()` policy on every table underneath,
 * which holds even if this layout is bypassed entirely.
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
    <div className="shell py-10 lg:py-14">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-line pb-5">
        <div>
          <p className="eyebrow">{t('title')}</p>
          <p className="mt-1 text-sm text-ink-muted">
            {viewer.fullName || viewer.email} · {viewer.role}
          </p>
        </div>
        <nav className="flex flex-wrap gap-1">
          {(
            [
              ['/dashboard', LayoutDashboard, t('title')],
              ['/admin/courses', BookOpen, t('courses')],
              ['/admin/cursus', GraduationCap, t('cursusNav')],
              ['/admin/pricing', Tag, t('pricing')],
              ['/admin/packs', CreditCard, t('packs')],
              ...(viewer.role === 'admin'
                ? [['/admin/payments', Wallet, t('payments')] as const]
                : []),
            ] as const
          ).map(([href, Icon, label]) => (
            <Link
              key={href}
              href={href}
              className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-[13px] text-ink-muted transition-colors hover:bg-brand-50 hover:text-brand-600"
            >
              <Icon className="size-4" aria-hidden="true" />
              {label}
            </Link>
          ))}
        </nav>
      </div>

      {/* The admin labels ride only inside this subtree, not on every
          public page. */}
      <NextIntlClientProvider messages={adminClientMessages(messages)}>
        <div className="pt-8">{children}</div>
      </NextIntlClientProvider>
    </div>
  );
}
