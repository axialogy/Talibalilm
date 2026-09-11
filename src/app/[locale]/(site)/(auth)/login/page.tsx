import { getTranslations, setRequestLocale } from 'next-intl/server';
import type { Metadata } from 'next';
import { Link } from '@/i18n/navigation';
import { AuthCard } from '@/components/auth/AuthCard';
import { LoginForm } from '@/components/auth/LoginForm';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'auth' });
  return { title: t('loginTitle'), robots: { index: false, follow: false } };
}

export default async function LoginPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ next?: string; reset?: string; error?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const { next: rawNext, reset, error } = await searchParams;

  // Sanitised here as well as in the server action. The action is what makes
  // it safe; this keeps an attacker-supplied absolute URL from being reflected
  // into the page's markup in the first place.
  const next = rawNext?.startsWith('/') && !rawNext.startsWith('//') ? rawNext : undefined;
  const t = await getTranslations('auth');
  const tErrors = await getTranslations('authErrors');

  // The callback route reports failures as a key, not a sentence, so the
  // message is localised here rather than baked into a redirect URL.
  const notice = reset === '1' ? t('resetDone') : undefined;
  const calloutError =
    error === 'expiredLink' ? tErrors('expiredLink') : error ? tErrors('unexpected') : undefined;

  return (
    <AuthCard
      title={t('loginTitle')}
      lead={calloutError ?? t('loginLead')}
      footer={
        <>
          {t('noAccount')}{' '}
          <Link href="/register" className="text-brand-600 underline underline-offset-4">
            {t('submitRegister')}
          </Link>
        </>
      }
    >
      <LoginForm next={next} notice={notice} />
    </AuthCard>
  );
}
