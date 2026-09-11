import { getTranslations, setRequestLocale } from 'next-intl/server';
import type { Metadata } from 'next';
import { Check, MapPin, ShieldCheck, Store, Video } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { Button } from '@/components/ui/button';
import { PageHero } from '@/components/marketing/PageHero';
import { PlanningTarifs } from '@/components/marketing/PlanningTarifs';
import { formatPrice } from '@/lib/commerce/quote';
import { getProgramme, listCursus, listProducts } from '@/lib/data/commerce';
import type { DeliveryMode } from '@/lib/supabase/database.types';

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
const FAQ = [1, 2, 3, 4, 5] as const;
const MODES: DeliveryMode[] = ['presentiel', 'online'];

// Prices change less often than the catalogue does, and this page is meant to
// be indexed, so it is regenerated hourly rather than rendered per request.
export const revalidate = 3600;

/**
 * The formations page.
 *
 * Everything on it — the two cursus, what each costs in each delivery mode,
 * how many modules the programme covers — is read from the catalogue tables.
 * There is no price written in this file, which is the point: the school edits
 * a row, not a deployment.
 */
export default async function PricingPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations('pricing');
  const tCheckout = await getTranslations('checkout');

  const [cursus, onsite, online] = await Promise.all([
    listCursus(),
    listProducts('presentiel'),
    listProducts('online'),
  ]);
  const productsByMode: Record<DeliveryMode, typeof onsite> = {
    presentiel: onsite,
    online,
  };

  // The cheapest way into each cursus, per mode: the entry price a shopper
  // compares before reading any further.
  const cards = await Promise.all(
    cursus.map(async (option) => {
      const modes = await Promise.all(
        MODES.map(async (mode) => {
          const relevant =
            option.kind === 'approfondi'
              ? productsByMode[mode].filter((p) => p.cursusId === option.id)
              : productsByMode[mode].filter((p) => p.kind === 'module');
          const from = relevant.length
            ? Math.min(...relevant.map((p) => p.priceCents))
            : null;
          const programme =
            option.kind === 'approfondi' ? await getProgramme(option.id, mode) : [];
          return {
            mode,
            from,
            moduleCount: option.kind === 'approfondi' ? programme.length : relevant.length,
          };
        }),
      );
      return { option, modes };
    }),
  );

  return (
    <>
      <PageHero crumb={t('title')} title={t('title')} lead={t('lead')} />

      <section className="py-14 sm:py-16">
        <div className="shell">
          {cards.length === 0 ? (
            <p className="rounded-[var(--radius-card)] border border-dashed border-line bg-surface/50 p-10 text-center text-sm text-ink-muted">
              {t('empty')}
            </p>
          ) : (
            <div className="grid gap-6 lg:grid-cols-2">
              {cards.map(({ option, modes }) => (
                <article
                  key={option.id}
                  className="flex flex-col rounded-[var(--radius-card)] border border-line bg-white p-8 shadow-card"
                >
                  <h2 className="font-display text-2xl font-semibold text-ink">{option.title}</h2>
                  {option.subtitle && (
                    <p className="mt-2 text-[14px] leading-relaxed text-ink-muted">
                      {option.subtitle}
                    </p>
                  )}

                  <ul className="mt-6 space-y-3">
                    {modes.map(({ mode, from, moduleCount }) => {
                      const Icon = mode === 'presentiel' ? MapPin : Video;
                      return (
                        <li
                          key={mode}
                          className="flex flex-wrap items-center gap-3 rounded-[var(--radius-input)] bg-surface/60 px-4 py-3"
                        >
                          <Icon className="size-4 shrink-0 text-brand-500" aria-hidden="true" />
                          <div className="min-w-0 flex-1">
                            <p className="text-[13px] font-medium text-ink">
                              {mode === 'presentiel'
                                ? tCheckout('modePresentiel')
                                : tCheckout('modeOnline')}
                            </p>
                            <p className="text-[11px] text-ink-muted">
                              {t('moduleCount', { count: moduleCount })}
                            </p>
                          </div>
                          <p className="font-display text-[15px] font-semibold text-ink">
                            {from === null ? '—' : t('fromPrice', { price: formatPrice(from, locale) })}
                          </p>
                        </li>
                      );
                    })}
                  </ul>

                  {option.description && (
                    <p className="mt-6 text-[13px] leading-relaxed text-ink-muted">
                      {option.description}
                    </p>
                  )}

                  <Button asChild block size="lg" className="mt-8">
                    <Link href="/checkout">{t('cta')}</Link>
                  </Button>
                </article>
              ))}
            </div>
          )}

          <div className="mt-4 grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:gap-12">
            <div>
              <h2 className="font-display text-xl font-semibold text-ink">{t('modeHeading')}</h2>
              <p className="mt-2 text-[13px] leading-relaxed text-ink-muted">{t('modeBody')}</p>

              <ul className="mt-6 space-y-3">
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

              <p className="mt-6 flex items-start gap-2 text-[11px] leading-relaxed text-ink-muted">
                <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-brand-500" aria-hidden="true" />
                <span>
                  <strong className="font-medium text-ink">{t('noAutoRenew')}.</strong>{' '}
                  {t('noAutoRenewBody')}
                </span>
              </p>

              <div className="mt-8 rounded-[var(--radius-card)] border border-line bg-surface/50 p-6">
                <h3 className="flex items-center gap-2 font-display text-[15px] font-semibold text-ink">
                  <Store className="size-4 text-brand-500" aria-hidden="true" />
                  {t('ctaOffice')}
                </h3>
                <p className="mt-2 text-[13px] leading-relaxed text-ink-muted">{t('officeNote')}</p>
              </div>
            </div>

            <div>
              <h2 className="font-display text-2xl font-semibold text-ink">{t('faqTitle')}</h2>
              <dl className="mt-5 space-y-5">
                {FAQ.map((n) => (
                  <div key={n} className="border-b border-line pb-5 last:border-0">
                    <dt className="font-display text-[15px] font-semibold text-ink">
                      {t(`faq${n}Q`)}
                    </dt>
                    <dd className="mt-2 text-[13px] leading-relaxed text-ink-muted">
                      {t(`faq${n}A`)}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>
        </div>
      </section>

      <PlanningTarifs entries={[...onsite, ...online]} locale={locale} />
    </>
  );
}
