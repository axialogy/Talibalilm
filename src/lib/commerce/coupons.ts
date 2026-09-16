import 'server-only';
import { createAdminClient } from '@/lib/supabase/server';
import { supabaseConfigured } from '@/lib/env';
import { couponDiscount, type AppliedCoupon } from '@/lib/commerce/quote';

/**
 * Reading a coupon without spending it.
 *
 * The payment step has to show what a code takes off before the student
 * commits — a discount discovered only after the money moved is not a
 * discount anyone trusts. The read goes through the service role because
 * `authenticated` holds no SELECT on `coupons` at all: a student who could
 * list them could try the front desk's batch.
 *
 * This is a PREVIEW. `redeem_coupon` is still the only thing that claims one,
 * atomically, at order creation; nothing here increments a counter.
 */
export interface CouponPreview {
  coupon: AppliedCoupon;
  discountCents: number;
}

export async function previewCoupon(
  code: string | null,
  /** What the coupon is taken off: the subtotal after any offer. */
  afterOffersCents: number,
): Promise<CouponPreview | null> {
  if (!code || !supabaseConfigured) return null;

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('coupons')
    .select('id, code, percent_off, amount_off_cents, max_redemptions, redeemed_count, expires_at')
    .eq('code', code)
    .maybeSingle();

  if (error || !data) return null;

  // The same conditions `redeem_coupon` applies, checked here so the screen
  // does not promise a discount the database will then refuse.
  if (data.expires_at && new Date(data.expires_at).getTime() <= Date.now()) return null;
  if (data.max_redemptions !== null && data.redeemed_count >= data.max_redemptions) return null;

  const coupon: AppliedCoupon = {
    id: data.id,
    code: data.code,
    percentOff: data.percent_off,
    amountOffCents: data.amount_off_cents,
  };

  return { coupon, discountCents: couponDiscount(coupon, afterOffersCents) };
}
