import { getTranslations, setRequestLocale } from 'next-intl/server';
import type { Metadata } from 'next';
import { AuthCard } from '@/components/auth/AuthCard';
import { ResetPasswordForm } from '@/components/auth/PasswordForms';
import { requireLocale } from '@/i18n/routing';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  requireLocale(locale);
  const t = await getTranslations({ locale, namespace: 'auth' });
  return { title: t('resetTitle'), robots: { index: false, follow: false } };
}

export default async function ResetPasswordPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  requireLocale(locale);
  setRequestLocale(locale);
  const t = await getTranslations('auth');

  return (
    <AuthCard title={t('resetTitle')} lead={t('resetLead')}>
      <ResetPasswordForm />
    </AuthCard>
  );
}
