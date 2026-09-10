import { getTranslations, setRequestLocale } from 'next-intl/server';
import type { Metadata } from 'next';
import { Check, ShieldCheck, Store } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { Button } from '@/components/ui/button';
import { PageHero } from '@/components/marketing/PageHero';
import { institut } from '@/lib/content/institut';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'pricing' });
  return { title: t('title'), description: t('lead') };
}

const FEATURES = ['allCourses', 'futureCourses', 'live', 'replays', 'quizzes', 'certificate'] as const;
const FAQ = [1, 2, 3, 4] as const;

export default async function PricingPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations('pricing');

  const price = new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: institut.currency,
    minimumFractionDigits: 0,
  }).format(institut.annualPriceCents / 100);

  return (
    <>
      <PageHero crumb={t('title')} title={t('title')} lead={t('lead')} />

      <section className="py-14 sm:py-16">
        <div className="shell grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:gap-12">
          <div className="rounded-[var(--radius-card)] border border-line bg-white p-8 shadow-card">
            <p className="eyebrow">{t('perYear')}</p>
            <p className="mt-3 font-display text-5xl font-semibold text-ink">{price}</p>

            <ul className="mt-8 space-y-3">
              {FEATURES.map((key) => (
                <li key={key} className="flex items-start gap-3 text-[13px] text-ink-muted">
                  <span
                    className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-600"
                    aria-hidden="true"
                  >
                    <Check className="size-3" />
                  </span>
                  {t(`features.${key}`)}
                </li>
              ))}
            </ul>

            <Button asChild block size="lg" className="mt-8">
              <Link href="/register">{t('cta')}</Link>
            </Button>

            <p className="mt-4 flex items-start gap-2 text-[11px] leading-relaxed text-ink-muted">
              <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-brand-500" aria-hidden="true" />
              <span>
                <strong className="font-medium text-ink">{t('noAutoRenew')}.</strong>{' '}
                {t('noAutoRenewBody')}
              </span>
            </p>
          </div>

          <div>
            <div className="rounded-[var(--radius-card)] border border-line bg-surface/50 p-6">
              <h2 className="flex items-center gap-2 font-display text-lg font-semibold text-ink">
                <Store className="size-4 text-brand-500" aria-hidden="true" />
                {t('ctaOffice')}
              </h2>
              <p className="mt-2 text-[13px] leading-relaxed text-ink-muted">{t('officeNote')}</p>
            </div>

            <h2 className="mt-10 font-display text-2xl font-semibold text-ink">{t('faqTitle')}</h2>
            <dl className="mt-5 space-y-5">
              {FAQ.map((n) => (
                <div key={n} className="border-b border-line pb-5 last:border-0">
                  <dt className="font-display text-[15px] font-semibold text-ink">{t(`faq${n}Q`)}</dt>
                  <dd className="mt-2 text-[13px] leading-relaxed text-ink-muted">{t(`faq${n}A`)}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </section>
    </>
  );
}
