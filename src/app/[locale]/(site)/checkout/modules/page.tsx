import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Check, Plus } from 'lucide-react';
import { Link, redirect } from '@/i18n/navigation';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CheckoutSteps } from '@/components/checkout/CheckoutSteps';
import { chooseCursusYear, toggleProduct } from '@/app/actions/checkout';
import { readSelection } from '@/lib/commerce/selection';
import {
  getProgramme,
  listProducts,
  programmeByYear,
  type ProgrammeEntry,
} from '@/lib/data/commerce';
import { formatPrice } from '@/lib/commerce/quote';

/**
 * Step 3 — what is actually being bought.
 *
 * Two shapes behind one URL. The Module cursus lists every module on offer and
 * lets the student tick the ones they want; the Approfondi lists the programme
 * year by year and asks which year they are enrolling in. They are the same
 * step because they answer the same question.
 */
export default async function ChooseModulesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const selection = await readSelection();
  // Destructured before the guards: TypeScript drops narrowing on a property
  // across an `await`, but keeps it on a plain const.
  const { kind, delivery, cursusId } = selection;
  if (!kind) redirect({ href: '/checkout', locale });
  if (!delivery) redirect({ href: '/checkout/mode', locale });

  const t = await getTranslations('checkout');
  const products = await listProducts(delivery);

  const isApprofondi = kind === 'approfondi';
  const chosen = new Set(selection.productIds);

  const modules = products.filter((p) => p.kind === 'module');
  const years = products
    .filter((p) => p.kind === 'cursus' && p.cursusId === cursusId)
    .sort((a, b) => a.yearIndex - b.yearIndex);

  const programme =
    isApprofondi && cursusId
      ? programmeByYear(await getProgramme(cursusId, delivery))
      : new Map<number, ProgrammeEntry[]>();

  const offered = isApprofondi ? years : modules;

  return (
    <>
      <CheckoutSteps current={3} />
      <h1 className="mt-6 font-display text-[clamp(1.5rem,3.4vw,2rem)] font-semibold text-ink">
        {t('steps.modules')}
      </h1>
      <p className="mt-2 max-w-xl text-[14px] leading-relaxed text-ink-muted">
        {isApprofondi ? t('modulesLeadApprofondi') : t('modulesLeadModule')}
      </p>

      {offered.length === 0 ? (
        <p className="mt-8 rounded-[var(--radius-card)] border border-dashed border-line bg-surface/50 p-8 text-center text-sm text-ink-muted">
          {t('modulesEmpty')}
        </p>
      ) : isApprofondi ? (
        <ul className="mt-8 space-y-4">
          {years.map((year) => (
            <li
              key={year.id}
              className="rounded-[var(--radius-card)] border border-line bg-white p-6"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-3">
                <h2 className="font-display text-[17px] font-semibold text-ink">
                  {t('yearLabel', { year: year.yearIndex })}
                </h2>
                <p className="font-display text-xl font-semibold text-ink">
                  {formatPrice(year.priceCents, locale)}
                </p>
              </div>

              <ul className="mt-4 space-y-1.5">
                {(programme.get(year.yearIndex) ?? []).map((entry) => (
                  <li key={entry.courseId} className="flex items-start gap-2 text-[13px] text-ink-muted">
                    <Check className="mt-0.5 size-3.5 shrink-0 text-brand-500" aria-hidden="true" />
                    <span>
                      <Link
                        href={`/courses/${entry.courseSlug}`}
                        className="transition-colors hover:text-brand-600"
                      >
                        {entry.courseTitle}
                      </Link>
                    </span>
                  </li>
                ))}
              </ul>

              <form action={chooseCursusYear} className="mt-5">
                <input type="hidden" name="productId" value={year.id} />
                <Button type="submit" size="md" variant={chosen.has(year.id) ? 'outline' : 'primary'}>
                  {chosen.has(year.id) ? t('selected') : t('select')}
                </Button>
              </form>
            </li>
          ))}
        </ul>
      ) : (
        <ul className="mt-8 space-y-2">
          {modules.map((product) => {
            const picked = chosen.has(product.id);
            return (
              <li key={product.id}>
                <form action={toggleProduct}>
                  <input type="hidden" name="productId" value={product.id} />
                  <button
                    type="submit"
                    aria-pressed={picked}
                    className={`flex w-full flex-wrap items-center gap-4 rounded-[var(--radius-card)] border p-4 text-start transition-colors ${
                      picked
                        ? 'border-brand-400 bg-brand-50/60'
                        : 'border-line bg-white hover:border-brand-300'
                    }`}
                  >
                    <span
                      className={`flex size-8 shrink-0 items-center justify-center rounded-lg ${
                        picked ? 'bg-brand-500 text-white' : 'bg-surface text-ink-muted'
                      }`}
                      aria-hidden="true"
                    >
                      {picked ? <Check className="size-4" /> : <Plus className="size-4" />}
                    </span>
                    <span className="min-w-0 flex-1 font-display text-[15px] font-semibold text-ink">
                      {product.title}
                    </span>
                    <span className="font-display text-[15px] font-semibold text-ink">
                      {formatPrice(product.priceCents, locale)}
                    </span>
                  </button>
                </form>
              </li>
            );
          })}
        </ul>
      )}

      <div className="mt-8 flex flex-wrap items-center justify-between gap-4">
        <Link
          href="/checkout/mode"
          className="text-[13px] text-ink-muted transition-colors hover:text-brand-600"
        >
          {t('backStep')}
        </Link>

        <div className="flex items-center gap-4">
          {!isApprofondi && <Badge variant="soft">{t('chosen', { count: chosen.size })}</Badge>}
          {chosen.size > 0 && (
            <Button asChild size="md">
              <Link href="/checkout/review">{t('continue')}</Link>
            </Button>
          )}
        </div>
      </div>
    </>
  );
}
