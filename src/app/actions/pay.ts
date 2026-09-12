'use server';

import { z } from 'zod';
import { headers } from 'next/headers';
import { redirect as nextRedirect } from 'next/navigation';
import { getLocale } from 'next-intl/server';
import { redirect } from '@/i18n/navigation';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { clientKey, rateLimit } from '@/lib/rate-limit';
import { loadBasket } from '@/lib/commerce/basket';
import { couponDiscount, MixedCurrencyError } from '@/lib/commerce/quote';
import { clearSelection } from '@/lib/commerce/selection';
import {
  createPendingOrder,
  attachProviderOrder,
  settleFreeOrder,
  releaseHolds,
  PackExhaustedError,
} from '@/lib/commerce/orders';
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

/**
 * Throttle a checkout entry point by caller. Office codes are single-use and
 * worth a year of access, so guessing one must not be free; keying on both the
 * request address and, once known, the signed-in user closes the obvious ways
 * to spread the attempts out.
 */
async function throttle(scope: string, limit: number, userId?: string): Promise<boolean> {
  const key = userId ? `${clientKey(await headers(), scope)}:${userId}` : clientKey(await headers(), scope);
  const { ok } = await rateLimit(key, { limit, windowMs: 15 * 60 * 1000 });
  return ok;
}

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
/** Hand a coupon back when the order that claimed it never opened. */
async function releaseCoupon(couponId: string): Promise<void> {
  const supabase = createAdminClient();
  await supabase.rpc('release_coupon', { coupon_id: couponId });
}

async function markOrderFailed(orderId: string, reason: string): Promise<void> {
  const supabase = createAdminClient();
  await supabase.from('orders').update({ status: 'failed', status_reason: reason }).eq('id', orderId);
}

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

  // Opening a PayPal order claims a coupon and a pack seat; cap how fast one
  // caller can churn through those holds.
  if (!(await throttle('checkout-start', 20, user.id))) return { error: 'rateLimited' };

  const { selection, quote } = await loadBasket();

  if (!quote || !selection.delivery) redirect({ href: '/checkout/modules', locale });

  // Checked after the basket is priced, not before: a basket that costs nothing
  // has no business being turned away because PayPal is unconfigured. The
  // zero-total branch below settles it without ever calling PayPal.
  const config = await getPayPalConfig();
  if (!config && quote.totalCents !== 0) return { error: 'unavailable' };

  const afterOffers = quote.subtotalCents - quote.discountCents;
  const coupon = await claimCoupon(selection.couponCode, afterOffers);

  let order;
  try {
    order = await createPendingOrder({
      userId: user.id,
      delivery: selection.delivery,
      route: 'paypal',
      quote,
      couponId: coupon?.id ?? null,
      couponDiscountCents: coupon?.discountCents ?? 0,
    });
  } catch (cause) {
    // The order never opened, so nothing will ever release the coupon this
    // request claimed a moment ago. Hand it straight back.
    if (coupon) await releaseCoupon(coupon.id);
    if (cause instanceof PackExhaustedError) return { error: 'packExhausted' };
    if (cause instanceof MixedCurrencyError) return { error: 'mixedCurrency' };
    throw cause;
  }

  // A coupon that brought the total to zero never reaches PayPal: there is
  // nothing to capture, and the grant path is the same either way.
  if (order.totalCents === 0) {
    await settleFreeOrder(order.id);
    await clearSelection();
    redirect({ href: `/checkout/confirmation?order=${order.id}`, locale });
  }

  if (!config) return { error: 'unavailable' };

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
    // The order exists and is holding a coupon and a pack redemption. Nothing
    // downstream will ever release them, because the student is never going to
    // reach PayPal's cancel route — they are about to see an error instead.
    await releaseHolds(order.id);
    await markOrderFailed(order.id, 'PayPal would not open the order');
    // Deliberately vague to the student, because the detail here is about our
    // credentials rather than anything they can act on.
    return { error: 'paypalRefused' };
  }

  // PayPal's own domain, so this leaves the app and cannot use the
  // locale-aware redirect.
  nextRedirect(approveUrl);
}

/**
 * Take a course the school is giving away.
 *
 * A free course is not a discount and not a coupon — the catalogue simply
 * prices it at zero. It still produces a real order and real entitlements
 * through `settleFreeOrder`, the same rows a paid enrolment leaves, because
 * `has_course_access()` is what opens the lessons and it knows nothing about
 * how the sale was funded.
 *
 * It exists as its own route because `startPayPalCheckout` refuses before it
 * ever reaches the zero-total branch when PayPal is not configured — so a
 * school that had not linked PayPal could not give anything away.
 *
 * The zero is never taken from the request. `loadBasket` reprices the selection
 * from the catalogue and `createPendingOrder` computes the total again; if that
 * total is not zero, the order is rolled back and the caller is sent to pay.
 */
export async function claimFreeCourse(_previous: PayState, _formData: FormData): Promise<PayState> {
  const locale = await getLocale();
  const user = await requireUser();

  if (!(await throttle('checkout-start', 20, user.id))) return { error: 'rateLimited' };

  const { selection, quote } = await loadBasket();
  if (!quote || !selection.delivery) redirect({ href: '/checkout/modules', locale });

  const afterOffers = quote.subtotalCents - quote.discountCents;
  const coupon = await claimCoupon(selection.couponCode, afterOffers);

  let order;
  try {
    order = await createPendingOrder({
      userId: user.id,
      delivery: selection.delivery,
      route: 'free',
      quote,
      couponId: coupon?.id ?? null,
      couponDiscountCents: coupon?.discountCents ?? 0,
    });
  } catch (cause) {
    if (coupon) await releaseCoupon(coupon.id);
    if (cause instanceof PackExhaustedError) return { error: 'packExhausted' };
    if (cause instanceof MixedCurrencyError) return { error: 'mixedCurrency' };
    throw cause;
  }

  // The catalogue disagreed with the page: something in the basket costs money.
  // Give back what the order was holding and send them to pay properly.
  if (order.totalCents !== 0) {
    await releaseHolds(order.id);
    await markOrderFailed(order.id, 'not a free basket');
    return { error: 'notFree' };
  }

  await settleFreeOrder(order.id);
  await clearSelection();
  redirect({ href: `/checkout/confirmation?order=${order.id}`, locale });
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

  // The one path where guessing pays: a valid office code is a year of access
  // for free. A shared, durable counter is what makes brute force uneconomical.
  if (!(await throttle('office-code', 10, user.id))) return { error: 'rateLimited' };

  const parsed = codeSchema.safeParse(formData.get('code') ?? '');
  if (!parsed.success) return { error: 'codeInvalid' };

  const { selection, quote } = await loadBasket();
  if (!quote || !selection.delivery) redirect({ href: '/checkout/modules', locale });

  const afterOffers = quote.subtotalCents - quote.discountCents;
  const coupon = await claimCoupon(parsed.data, afterOffers);
  if (!coupon) return { error: 'codeRefused' };

  let order;
  try {
    order = await createPendingOrder({
      userId: user.id,
      delivery: selection.delivery,
      route: 'office',
      quote,
      couponId: coupon.id,
      couponDiscountCents: coupon.discountCents,
    });
  } catch (cause) {
    await releaseCoupon(coupon.id);
    if (cause instanceof PackExhaustedError) return { error: 'packExhausted' };
    if (cause instanceof MixedCurrencyError) return { error: 'mixedCurrency' };
    throw cause;
  }

  // A code worth less than the basket leaves something to pay. Rather than
  // half-granting, the order stands and the student is sent to PayPal for the
  // rest — the coupon is already attached to it.
  if (order.totalCents > 0) return { error: 'codePartial' };

  await settleFreeOrder(order.id);
  await clearSelection();
  redirect({ href: `/checkout/confirmation?order=${order.id}`, locale });
}
