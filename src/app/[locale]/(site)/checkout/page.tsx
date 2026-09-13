import { getTranslations, setRequestLocale } from 'next-intl/server';
import { CheckoutFlow } from '@/components/checkout/CheckoutFlow';

/**
 * Enrolment, as one page.
 *
 * There used to be five URLs here — cursus, mode, modules, review, payment —
 * and answering a question navigated. Now there is one card that keeps its
 * place while its contents change, which is also what lets the same flow sit
 * under a module's page.
 */
export default async function CheckoutPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { locale } = await params;
  const { error } = await searchParams;
  setRequestLocale(locale);

  const t = await getTranslations('checkout');

  return (
    <>
      <h1 className="font-display text-[clamp(1.5rem,3.4vw,2rem)] font-semibold text-ink">
        {t('title')}
      </h1>
      <p className="mt-2 max-w-xl text-[14px] leading-relaxed text-ink-muted">{t('cursusLead')}</p>

      <div className="mt-8">
        <CheckoutFlow locale={locale} returnError={error} />
      </div>
    </>
  );
}
