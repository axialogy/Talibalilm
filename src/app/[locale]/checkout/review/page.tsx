import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Gift, Tag } from 'lucide-react';
import { Link, redirect } from '@/i18n/navigation';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CheckoutSteps } from '@/components/checkout/CheckoutSteps';
import { applyCoupon } from '@/app/actions/checkout';
import { loadBasket } from '@/lib/commerce/basket';
import { formatPrice } from '@/lib/commerce/quote';

/** Step 4 — what it costs, and why. */
export default async function ReviewPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  const { selection, quote } = await loadBasket();
  if (!selection.kind) redirect({ href: '/checkout', locale });
  if (!selection.delivery) redirect({ href: '/checkout/mode', locale });
  if (!quote) redirect({ href: '/checkout/modules', locale });

  const t = await getTranslations('checkout');

  return (
    <>
      <CheckoutSteps current={4} />
      <h1 className="mt-6 font-display text-[clamp(1.5rem,3.4vw,2rem)] font-semibold text-ink">
        {t('steps.review')}
      </h1>
      <p className="mt-2 max-w-xl text-[14px] leading-relaxed text-ink-muted">{t('reviewLead')}</p>

      <div className="mt-8 rounded-[var(--radius-card)] border border-line bg-white">
        <ul className="divide-y divide-line">
          {quote.lines.map((line) => (
            <li key={line.productId} className="flex flex-wrap items-center gap-3 p-5">
              <div className="min-w-0 flex-1">
                <p className="font-display text-[15px] font-semibold text-ink">{line.title}</p>
                <p className="mt-0.5 text-[11px] text-ink-muted">
                  {t('duration', { days: line.durationDays })}
                </p>
              </div>
              {line.isFree ? (
                <div className="flex items-center gap-2">
                  <span className="text-[13px] text-ink-muted line-through">
                    {formatPrice(line.listPriceCents, locale)}
                  </span>
                  <Badge variant="gold">{t('offerFree')}</Badge>
                </div>
              ) : (
                <span className="font-display text-[15px] font-semibold text-ink">
                  {formatPrice(line.unitPriceCents, locale)}
                </span>
              )}
            </li>
          ))}
        </ul>

        {quote.pack && (
          <p className="flex items-center gap-2 border-t border-line bg-brand-50/50 px-5 py-3 text-[13px] text-brand-700">
            <Gift className="size-4 shrink-0" aria-hidden="true" />
            {t('offerApplied', { name: quote.pack.title })}
          </p>
        )}

        <dl className="space-y-2 border-t border-line p-5 text-[13px]">
          <div className="flex justify-between text-ink-muted">
            <dt>{t('subtotal')}</dt>
            <dd>{formatPrice(quote.subtotalCents, locale)}</dd>
          </div>
          {quote.discountCents > 0 && (
            <div className="flex justify-between text-brand-600">
              <dt>{t('discount')}</dt>
              <dd>−{formatPrice(quote.discountCents, locale)}</dd>
            </div>
          )}
          <div className="flex justify-between border-t border-line pt-2 font-display text-lg font-semibold text-ink">
            <dt>{t('total')}</dt>
            <dd>{formatPrice(quote.totalCents, locale)}</dd>
          </div>
        </dl>
      </div>

      {/*
        The code is stored, not checked. Telling a visitor here whether a code
        exists would turn this form into an oracle for guessing the front
        desk's cash codes, each of which is worth a year of teaching. It is
        validated and spent server-side at the moment of payment instead.
      */}
      <form
        action={applyCoupon}
        className="mt-6 flex flex-wrap items-end gap-3 rounded-[var(--radius-card)] border border-dashed border-line bg-surface/40 p-5"
      >
        <label className="min-w-[220px] flex-1">
          <span className="mb-1.5 flex items-center gap-1.5 text-[13px] font-medium text-ink">
            <Tag className="size-3.5 text-ink-muted" aria-hidden="true" />
            {t('couponLabel')}
          </span>
          <input
            name="code"
            defaultValue={selection.couponCode ?? ''}
            maxLength={32}
            autoComplete="off"
            spellCheck={false}
            className="w-full rounded-[var(--radius-input)] border border-line bg-white px-3 py-2.5 text-sm tracking-wide text-ink uppercase outline-none focus:border-brand-400"
          />
          <span className="mt-1.5 block text-[11px] text-ink-muted">{t('couponHint')}</span>
        </label>
        <Button type="submit" variant="outline" size="md">
          {t('couponApply')}
        </Button>
      </form>

      {selection.couponCode && (
        <p role="status" className="mt-2 text-[12px] text-brand-600">
          {t('couponStored', { code: selection.couponCode })}
        </p>
      )}

      <div className="mt-8 flex flex-wrap items-center justify-between gap-4">
        <Link
          href="/checkout/modules"
          className="text-[13px] text-ink-muted transition-colors hover:text-brand-600"
        >
          {t('backStep')}
        </Link>
        <Button asChild size="lg">
          <Link href="/checkout/payment">{t('continue')}</Link>
        </Button>
      </div>
    </>
  );
}
