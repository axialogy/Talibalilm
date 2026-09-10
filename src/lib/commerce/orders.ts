import 'server-only';
import { createAdminClient } from '@/lib/supabase/server';
import type { Quote } from '@/lib/commerce/quote';
import type { DeliveryMode, PaymentRoute } from '@/lib/supabase/database.types';

/**
 * Turning a priced basket into an order, and an order into access.
 *
 * Both payment routes come through here — PayPal and the front desk's cash
 * coupon — so the two cannot drift. The service role is used because
 * `authenticated` holds no INSERT on `orders` at all: a browser that could
 * write an order could name its own total.
 *
 * Everything below assumes `quote` was produced by `priceSelection` in this
 * same request, from ids checked against the published catalogue. Nothing here
 * re-derives a price, and nothing here accepts one from a caller's caller.
 */

export interface CreateOrderInput {
  userId: string;
  delivery: DeliveryMode;
  route: PaymentRoute;
  quote: Quote;
  /** Already claimed through `redeem_coupon`, or null. */
  couponId?: string | null;
  couponDiscountCents?: number;
}

export interface CreatedOrder {
  id: string;
  totalCents: number;
  currency: string;
}

export async function createPendingOrder(input: CreateOrderInput): Promise<CreatedOrder> {
  const { userId, delivery, route, quote, couponId = null, couponDiscountCents = 0 } = input;
  const supabase = createAdminClient();

  // The coupon is applied here rather than inside `priceSelection` because it
  // is only claimed at this point — the review page shows the pre-coupon
  // figure on purpose.
  const discountCents = Math.min(quote.discountCents + couponDiscountCents, quote.subtotalCents);
  const totalCents = quote.subtotalCents - discountCents;

  const { data: order, error } = await supabase
    .from('orders')
    .insert({
      user_id: userId,
      route,
      delivery,
      subtotal_cents: quote.subtotalCents,
      discount_cents: discountCents,
      total_cents: totalCents,
      coupon_id: couponId,
      pack_id: quote.pack?.id ?? null,
      status: 'pending',
    })
    .select('id, total_cents, currency')
    .single();

  if (error || !order) throw new Error(`Could not open the order: ${error?.message ?? 'no row'}`);

  const { error: itemsError } = await supabase.from('order_items').insert(
    quote.lines.map((line) => ({
      order_id: order.id,
      product_id: line.productId,
      kind: line.kind,
      course_id: line.courseId,
      cursus_id: line.cursusId,
      year_index: line.yearIndex,
      delivery: line.delivery,
      unit_price_cents: line.unitPriceCents,
      duration_days: line.durationDays,
      is_free: line.isFree,
      title: line.title,
    })),
  );

  // The deferred constraint on `order_items` compares their sum against the
  // subtotal, so a pricing mistake fails here rather than becoming an invoice.
  if (itemsError) {
    await supabase.from('orders').delete().eq('id', order.id);
    throw new Error(`Could not record what was ordered: ${itemsError.message}`);
  }

  return { id: order.id, totalCents: order.total_cents, currency: order.currency };
}

export async function attachProviderOrder(orderId: string, providerOrderId: string): Promise<void> {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from('orders')
    .update({ provider_order_id: providerOrderId })
    .eq('id', orderId);
  if (error) throw new Error(`Could not record the PayPal order id: ${error.message}`);
}

export type SettleResult =
  | { ok: true; alreadyPaid: boolean; orderId: string }
  | { ok: false; reason: 'not_found' | 'amount_mismatch' | 'not_completed' };

/**
 * Mark an order paid and hand over what it bought.
 *
 * Idempotent from end to end: the status check short-circuits a replay, and
 * `grant_order_entitlements` refuses to grant twice for the same order anyway.
 * PayPal retries its webhooks, and the return page and the webhook race each
 * other by design — whichever arrives second must be a no-op.
 *
 * The amount comparison is the important line. A capture that does not match
 * what we asked for is never accepted, however cleanly it was signed.
 */
export async function settleOrder(options: {
  orderId: string;
  capturedCents: number | null;
  currency: string | null;
  captureId: string | null;
  status: string;
}): Promise<SettleResult> {
  const { orderId, capturedCents, currency, captureId, status } = options;
  const supabase = createAdminClient();

  const { data: order } = await supabase
    .from('orders')
    .select('id, status, total_cents, currency, coupon_id')
    .eq('id', orderId)
    .maybeSingle();

  if (!order) return { ok: false, reason: 'not_found' };
  if (order.status === 'paid') return { ok: true, alreadyPaid: true, orderId };

  if (status !== 'COMPLETED') {
    await markFailed(orderId, order.coupon_id);
    return { ok: false, reason: 'not_completed' };
  }

  if (capturedCents !== order.total_cents || (currency !== null && currency !== order.currency)) {
    await markFailed(orderId, order.coupon_id);
    return { ok: false, reason: 'amount_mismatch' };
  }

  const { error } = await supabase
    .from('orders')
    .update({
      status: 'paid',
      paid_at: new Date().toISOString(),
      provider_capture_id: captureId,
    })
    .eq('id', orderId)
    // Only a pending order becomes paid. If a concurrent settle got there
    // first, this matches nothing and the grant below is its no-op.
    .eq('status', 'pending');

  if (error) throw new Error(`Could not mark the order paid: ${error.message}`);

  await supabase.rpc('grant_order_entitlements', { oid: orderId });
  return { ok: true, alreadyPaid: false, orderId };
}

/** A free order — the office cash route — is paid the moment it is created. */
export async function settleFreeOrder(orderId: string): Promise<void> {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from('orders')
    .update({ status: 'paid', paid_at: new Date().toISOString() })
    .eq('id', orderId)
    .eq('status', 'pending');

  if (error) throw new Error(`Could not mark the order paid: ${error.message}`);
  await supabase.rpc('grant_order_entitlements', { oid: orderId });
}

async function markFailed(orderId: string, couponId: string | null): Promise<void> {
  const supabase = createAdminClient();
  await supabase.from('orders').update({ status: 'failed' }).eq('id', orderId);
  // Hand the code back. It was claimed when the order opened, and an order
  // that never completed should not have cost the school a coupon.
  if (couponId) await supabase.rpc('release_coupon', { coupon_id: couponId });
}

export async function cancelOrder(orderId: string, userId: string): Promise<void> {
  const supabase = createAdminClient();
  const { data: order } = await supabase
    .from('orders')
    .select('id, coupon_id, user_id, status')
    .eq('id', orderId)
    .maybeSingle();

  // Scoped to the owner: a cancel is triggered by a redirect back from PayPal,
  // and the order id travels in the URL.
  if (!order || order.user_id !== userId || order.status !== 'pending') return;

  await supabase.from('orders').update({ status: 'cancelled' }).eq('id', orderId);
  if (order.coupon_id) await supabase.rpc('release_coupon', { coupon_id: order.coupon_id });
}
