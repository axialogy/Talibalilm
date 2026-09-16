import { readSelection, type Selection } from '@/lib/commerce/selection';
import { listPacks, listProducts } from '@/lib/data/commerce';
import { priceSelection, type Quote } from '@/lib/commerce/quote';
import { previewCoupon } from '@/lib/commerce/coupons';

/**
 * The basket, priced.
 *
 * Every step that shows a number calls this, and so does the payment route
 * when it tells PayPal what to charge. There is exactly one of these functions
 * on purpose: a second place that works out a total is a second place that can
 * disagree with the first.
 */
export interface Basket {
  selection: Selection;
  quote: Quote | null;
}

export async function loadBasket(): Promise<Basket> {
  const selection = await readSelection();
  const { delivery, productIds } = selection;

  if (!delivery || productIds.length === 0) return { selection, quote: null };

  const [offered, packs] = await Promise.all([listProducts(delivery), listPacks(delivery)]);

  // Filtered against the published price list rather than trusted: an id in
  // the cookie that is no longer on sale simply falls out of the basket.
  const chosen = offered.filter((product) => productIds.includes(product.id));
  if (chosen.length === 0) return { selection, quote: null };

  // Priced once without the coupon to learn what the coupon comes off, then
  // again with it. The preview is read-only — the code is still claimed
  // atomically by `redeem_coupon` when the order opens, and this only lets the
  // payment step show the figure the student will actually be charged.
  const priced = priceSelection({ products: chosen, packs, delivery });
  const preview = await previewCoupon(selection.couponCode, priced.subtotalCents - priced.discountCents);

  return {
    selection,
    quote: preview
      ? priceSelection({ products: chosen, packs, delivery, coupon: preview.coupon })
      : priced,
  };
}
