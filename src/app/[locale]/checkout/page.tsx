import { getTranslations, setRequestLocale } from 'next-intl/server';
import { GraduationCap, Layers } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { Button } from '@/components/ui/button';
import { CheckoutSteps } from '@/components/checkout/CheckoutSteps';
import { chooseCursus } from '@/app/actions/checkout';
import { readSelection } from '@/lib/commerce/selection';
import { listCursus } from '@/lib/data/commerce';

/** Step 1 — which of the two cursus. */
export default async function ChooseCursusPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations('checkout');
  const [cursus, selection] = await Promise.all([listCursus(), readSelection()]);

  return (
    <>
      <CheckoutSteps current={1} />
      <h1 className="mt-6 font-display text-[clamp(1.5rem,3.4vw,2rem)] font-semibold text-ink">
        {t('steps.cursus')}
      </h1>
      <p className="mt-2 max-w-xl text-[14px] leading-relaxed text-ink-muted">{t('cursusLead')}</p>

      {cursus.length === 0 ? (
        <p className="mt-8 rounded-[var(--radius-card)] border border-dashed border-line bg-surface/50 p-8 text-center text-sm text-ink-muted">
          {t('cursusEmpty')}
        </p>
      ) : (
        <ul className="mt-8 grid gap-4 sm:grid-cols-2">
          {cursus.map((option) => {
            const chosen = selection.cursusId === option.id;
            const Icon = option.kind === 'approfondi' ? GraduationCap : Layers;
            return (
              <li key={option.id}>
                <form action={chooseCursus} className="h-full">
                  <input type="hidden" name="kind" value={option.kind} />
                  <input type="hidden" name="cursusId" value={option.id} />
                  <button
                    type="submit"
                    aria-pressed={chosen}
                    className={`flex h-full w-full flex-col items-start rounded-[var(--radius-card)] border p-6 text-start transition-colors ${
                      chosen
                        ? 'border-brand-400 bg-brand-50/60'
                        : 'border-line bg-white hover:border-brand-300'
                    }`}
                  >
                    <span
                      className="flex size-10 items-center justify-center rounded-lg bg-brand-50 text-brand-600"
                      aria-hidden="true"
                    >
                      <Icon className="size-5" />
                    </span>
                    <span className="mt-4 font-display text-[17px] font-semibold text-ink">
                      {option.title}
                    </span>
                    <span className="mt-2 text-[13px] leading-relaxed text-ink-muted">
                      {option.subtitle ||
                        (option.kind === 'approfondi'
                          ? t('cursusApprofondiBody')
                          : t('cursusModuleBody'))}
                    </span>
                    {option.yearCount > 1 && (
                      <span className="mt-3 text-[11px] text-brand-600">
                        {t('yearLabel', { year: option.yearCount })}
                      </span>
                    )}
                  </button>
                </form>
              </li>
            );
          })}
        </ul>
      )}

      {selection.cursusId && (
        <div className="mt-8">
          <Button asChild size="md">
            <Link href="/checkout/mode">{t('continue')}</Link>
          </Button>
        </div>
      )}
    </>
  );
}
