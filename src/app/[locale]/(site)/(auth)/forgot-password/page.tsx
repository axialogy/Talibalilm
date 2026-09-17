import { getTranslations, setRequestLocale } from 'next-intl/server';
import type { Metadata } from 'next';
import { Link } from '@/i18n/navigation';
import { AuthCard } from '@/components/auth/AuthCard';
import { ForgotPasswordForm } from '@/components/auth/PasswordForms';
import { requireLocale } from '@/i18n/routing';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  requireLocale(locale);
  const t = await getTranslations({ locale, namespace: 'auth' });
  return { title: t('forgotTitle'), robots: { index: false, follow: false } };
}

export default async function ForgotPasswordPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  requireLocale(locale);
  setRequestLocale(locale);
  const t = await getTranslations('auth');

  return (
    <AuthCard
      title={t('forgotTitle')}
      lead={t('forgotLead')}
      footer={
        <Link href="/login" className="text-brand-600 underline underline-offset-4">
          {t('backToLogin')}
        </Link>
      }
    >
      <ForgotPasswordForm />
    </AuthCard>
  );
}
