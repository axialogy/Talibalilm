import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Info, Lock, Store } from 'lucide-react';
import { Link, redirect } from '@/i18n/navigation';
import { Button } from '@/components/ui/button';
import { CheckoutSteps } from '@/components/checkout/CheckoutSteps';
import { loadBasket } from '@/lib/commerce/basket';
import { formatPrice } from '@/lib/commerce/quote';
import { createClient } from '@/lib/supabase/server';
import { supabaseConfigured } from '@/lib/env';

/**
 * Step 5 — payment.
 *
 * The amount shown here is recomputed from the selection on this render, and
 * the payment route will recompute it again before it asks PayPal for
 * anything. Nothing on this page is trusted to carry a price forward.
 */
export default async function PaymentPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  const { selection, quote } = await loadBasket();
  if (!quote) redirect({ href: '/checkout/modules', locale });

  const t = await getTranslations('checkout');

  // Signing in is required to pay, because an entitlement has to belong to
  // somebody. The selection survives in its cookie across the round trip.
  let signedIn = false;
  if (supabaseConfigured) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    signedIn = user !== null;
  }

  return (
    <>
      <CheckoutSteps current={5} />
      <h1 className="mt-6 font-display text-[clamp(1.5rem,3.4vw,2rem)] font-semibold text-ink">
        {t('payTitle')}
      </h1>
      <p className="mt-2 max-w-xl text-[14px] leading-relaxed text-ink-muted">{t('payLead')}</p>

      <div className="mt-8 rounded-[var(--radius-card)] border border-line bg-white p-6">
        <dl className="flex items-baseline justify-between">
          <dt className="font-display text-[15px] font-semibold text-ink">{t('total')}</dt>
          <dd className="font-display text-3xl font-semibold text-ink">
            {formatPrice(quote.totalCents, locale)}
          </dd>
        </dl>
        <ul className="mt-4 space-y-1 border-t border-line pt-4">
          {quote.lines.map((line) => (
            <li key={line.productId} className="flex justify-between text-[13px] text-ink-muted">
              <span>{line.title}</span>
              <span>{line.isFree ? t('offerFree') : formatPrice(line.unitPriceCents, locale)}</span>
            </li>
          ))}
        </ul>

        {selection.couponCode && (
          <p className="mt-4 text-[12px] text-ink-muted">
            {t('couponStored', { code: selection.couponCode })} — {t('couponHint')}
          </p>
        )}

        <div className="mt-6">
          {signedIn ? (
            <>
              <Button block size="lg" disabled>
                <Lock className="size-4" aria-hidden="true" />
                {t('payWithPaypal')}
              </Button>
              <p className="mt-3 flex items-start gap-2 text-[12px] leading-relaxed text-ink-muted">
                <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
                {t('payPending')}
              </p>
            </>
          ) : (
            <>
              <p className="text-[13px] text-ink-muted">{t('loginRequired')}</p>
              <Button asChild block size="lg" className="mt-3">
                <Link href="/login?next=%2Fcheckout%2Fpayment">{t('loginCta')}</Link>
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="mt-6 rounded-[var(--radius-card)] border border-line bg-surface/50 p-5">
        <h2 className="flex items-center gap-2 font-display text-[15px] font-semibold text-ink">
          <Store className="size-4 text-brand-500" aria-hidden="true" />
          {t('payOffice')}
        </h2>
        <p className="mt-2 text-[13px] leading-relaxed text-ink-muted">{t('payOfficeBody')}</p>
      </div>

      <p className="mt-8">
        <Link
          href="/checkout/review"
          className="text-[13px] text-ink-muted transition-colors hover:text-brand-600"
        >
          {t('backStep')}
        </Link>
      </p>
    </>
  );
}
