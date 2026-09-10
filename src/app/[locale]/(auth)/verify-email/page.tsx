import { getTranslations, setRequestLocale } from 'next-intl/server';
import type { Metadata } from 'next';
import { MailCheck } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { AuthCard } from '@/components/auth/AuthCard';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'auth' });
  return { title: t('verifyTitle'), robots: { index: false, follow: false } };
}

export default async function VerifyEmailPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ email?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const { email } = await searchParams;
  const t = await getTranslations('auth');

  return (
    <AuthCard
      title={t('verifyTitle')}
      footer={
        <Link href="/login" className="text-brand-600 underline underline-offset-4">
          {t('backToLogin')}
        </Link>
      }
    >
      <div className="flex flex-col items-center gap-4 text-center">
        <span
          className="flex size-12 items-center justify-center rounded-full bg-brand-50 text-brand-600"
          aria-hidden="true"
        >
          <MailCheck className="size-5" />
        </span>
        <p className="text-[13px] leading-relaxed text-ink-muted">
          {t('verifyLead', { email: email ?? '' })}
        </p>
      </div>
    </AuthCard>
  );
}
