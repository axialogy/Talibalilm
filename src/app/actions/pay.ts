'use server';

import { z } from 'zod';
import { redirect as nextRedirect } from 'next/navigation';
import { getLocale } from 'next-intl/server';
import { redirect } from '@/i18n/navigation';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { loadBasket } from '@/lib/commerce/basket';
import { couponDiscount } from '@/lib/commerce/quote';
import { clearSelection } from '@/lib/commerce/selection';
import { createPendingOrder, attachProviderOrder, settleFreeOrder } from '@/lib/commerce/orders';
import { createPayPalOrder, getPayPalConfig } from '@/lib/paypal/client';
import { siteUrl } from '@/lib/env';

/**
 * Payment.
 *
 * Both routes below reprice the basket from the catalogue before they do
 * anything. Neither accepts an amount, a product price, or a discount from the
 * caller — the only thing the browser contributes is a coupon code, and that
 * is spent by a single atomic UPDATE in the database.
 */

export type PayState = { error?: string };

async function requireUser(): Promise<{ id: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // An entitlement has to belong to somebody, so paying requires an account.
  // The selection survives the round trip in its own cookie.
  if (!user) redirect({ href: '/login?next=%2Fcheckout%2Fpayment', locale: await getLocale() });
  return { id: user.id };
}

/**
 * Claim a coupon, or say why not.
 *
 * `redeem_coupon` increments the count inside its own WHERE clause, so a code
 * with one redemption left goes to exactly one of two simultaneous checkouts.
 * It is claimed HERE, at order creation — discovering a code was spent after
 * the student's money has moved is far worse than discovering it at the basket.
 */
async function claimCoupon(
  code: string | null,
  subtotalCents: number,
): Promise<{ id: string; discountCents: number } | null> {
  if (!code) return null;

  const supabase = createAdminClient();
  const { data: couponId } = await supabase.rpc('redeem_coupon', { coupon_code: code });
  if (!couponId) return null;

  const { data: coupon } = await supabase
    .from('coupons')
    .select('id, code, percent_off, amount_off_cents')
    .eq('id', couponId)
    .single();

  if (!coupon) return null;
  return {
    id: coupon.id,
    discountCents: couponDiscount(
      {
        id: coupon.id,
        code: coupon.code,
        percentOff: coupon.percent_off,
        amountOffCents: coupon.amount_off_cents,
      },
      subtotalCents,
    ),
  };
}

/**
 * Open a PayPal order and send the student to PayPal's own approval page.
 *
 * A redirect rather than PayPal's browser SDK: no key, no amount and no order
 * id ends up in the page, and the capture happens entirely server-side when
 * the student comes back.
 */
export async function startPayPalCheckout(
  _previous: PayState,
  _formData: FormData,
): Promise<PayState> {
  const locale = await getLocale();
  const user = await requireUser();
  const { selection, quote } = await loadBasket();

  if (!quote || !selection.delivery) redirect({ href: '/checkout/modules', locale });

  const config = await getPayPalConfig();
  if (!config) return { error: 'unavailable' };

  const afterOffers = quote.subtotalCents - quote.discountCents;
  const coupon = await claimCoupon(selection.couponCode, afterOffers);

  const order = await createPendingOrder({
    userId: user.id,
    delivery: selection.delivery,
    route: 'paypal',
    quote,
    couponId: coupon?.id ?? null,
    couponDiscountCents: coupon?.discountCents ?? 0,
  });

  // A coupon that brought the total to zero never reaches PayPal: there is
  // nothing to capture, and the grant path is the same either way.
  if (order.totalCents === 0) {
    await settleFreeOrder(order.id);
    await clearSelection();
    redirect({ href: `/checkout/confirmation?order=${order.id}`, locale });
  }

  const base = siteUrl();
  let approveUrl: string;
  try {
    const created = await createPayPalOrder({
      config,
      amountCents: order.totalCents,
      currency: order.currency,
      referenceId: order.id,
      returnUrl: `${base}/api/paypal/return?order=${order.id}`,
      cancelUrl: `${base}/api/paypal/cancel?order=${order.id}`,
      description: quote.lines.map((l) => l.title).join(', ') || 'Institut Talib Alim',
    });
    await attachProviderOrder(order.id, created.id);
    approveUrl = created.approveUrl;
  } catch {
    // Deliberately vague to the student, because the detail here is about our
    // credentials rather than anything they can act on.
    return { error: 'paypalRefused' };
  }

  // PayPal's own domain, so this leaves the app and cannot use the
  // locale-aware redirect.
  nextRedirect(approveUrl);
}

const codeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z0-9-]{6,32}$/);

/**
 * The front desk's cash route.
 *
 * The student pays in the office, is handed a single-use 100 %-off code, and
 * types it here. It produces exactly the same `orders` and `entitlements` rows
 * as a card payment, through the same `grant_order_entitlements` — which is the
 * requirement, not an implementation detail.
 */
export async function redeemOfficeCode(
  _previous: PayState,
  formData: FormData,
): Promise<PayState> {
  const locale = await getLocale();
  const user = await requireUser();
  const parsed = codeSchema.safeParse(formData.get('code') ?? '');
  if (!parsed.success) return { error: 'codeInvalid' };

  const { selection, quote } = await loadBasket();
  if (!quote || !selection.delivery) redirect({ href: '/checkout/modules', locale });

  const afterOffers = quote.subtotalCents - quote.discountCents;
  const coupon = await claimCoupon(parsed.data, afterOffers);
  if (!coupon) return { error: 'codeRefused' };

  const order = await createPendingOrder({
    userId: user.id,
    delivery: selection.delivery,
    route: 'office',
    quote,
    couponId: coupon.id,
    couponDiscountCents: coupon.discountCents,
  });

  // A code worth less than the basket leaves something to pay. Rather than
  // half-granting, the order stands and the student is sent to PayPal for the
  // rest — the coupon is already attached to it.
  if (order.totalCents > 0) return { error: 'codePartial' };

  await settleFreeOrder(order.id);
  await clearSelection();
  redirect({ href: `/checkout/confirmation?order=${order.id}`, locale });
}
