import { getTranslations, setRequestLocale } from 'next-intl/server';
import { AlertCircle } from 'lucide-react';
import { Link, redirect } from '@/i18n/navigation';
import { Button } from '@/components/ui/button';
import { CheckoutSteps } from '@/components/checkout/CheckoutSteps';
import { PaymentForms } from '@/components/checkout/PaymentForms';
import { loadBasket } from '@/lib/commerce/basket';
import { formatPrice } from '@/lib/commerce/quote';
import { getPayPalConfig } from '@/lib/paypal/client';
import { createClient } from '@/lib/supabase/server';
import { supabaseConfigured } from '@/lib/env';

/** Errors handed back by the PayPal return and cancel routes, in the URL. */
const RETURN_ERRORS: Record<string, string> = {
  cancelled: 'payCancelled',
  amount_mismatch: 'payMismatch',
  not_completed: 'payNotCompleted',
  not_found: 'payUnexpected',
  unexpected: 'payUnexpected',
  unavailable: 'payUnavailable',
  paypalRefused: 'payRefused',
};

/**
 * Step 5 — payment.
 *
 * The amount shown here is recomputed from the selection on this render, and
 * the payment route will recompute it again before it asks PayPal for
 * anything. Nothing on this page is trusted to carry a price forward.
 */
export default async function PaymentPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { locale } = await params;
  const { error } = await searchParams;
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

  // Resolved server-side and reduced to a boolean before it crosses into the
  // client component: the config carries the PayPal secret.
  const paypalAvailable = (await getPayPalConfig()) !== null;

  // Recomputed from the catalogue on this render, like every other total here.
  const free = quote.totalCents === 0;
  const returnError = error ? RETURN_ERRORS[error] : undefined;

  return (
    <>
      <CheckoutSteps current={5} />
      <h1 className="mt-6 font-display text-[clamp(1.5rem,3.4vw,2rem)] font-semibold text-ink">
        {t('payTitle')}
      </h1>
      <p className="mt-2 max-w-xl text-[14px] leading-relaxed text-ink-muted">{t('payLead')}</p>

      {returnError && (
        <p
          role="alert"
          className="mt-6 flex items-start gap-2 rounded-[var(--radius-card)] border border-line bg-surface/60 p-4 text-[13px] leading-relaxed text-ink"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0 text-ink-muted" aria-hidden="true" />
          {t(returnError)}
        </p>
      )}

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

      </div>

      <div className="mt-6">
        {signedIn ? (
          <PaymentForms paypalAvailable={paypalAvailable} free={free} />
        ) : (
          <div className="rounded-[var(--radius-card)] border border-line bg-white p-6">
            <p className="text-[13px] text-ink-muted">{t('loginRequired')}</p>
            <Button asChild block size="lg" className="mt-3">
              <Link href="/login?next=%2Fcheckout%2Fpayment">{t('loginCta')}</Link>
            </Button>
          </div>
        )}
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
