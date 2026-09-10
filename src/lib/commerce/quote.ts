import type { DeliveryMode, PackPricing } from '@/lib/supabase/database.types';

/**
 * Pricing.
 *
 * Every total the student is ever shown, and the one PayPal is asked to
 * capture, comes out of this file. It is deliberately pure: it takes rows the
 * caller has already read from the database and returns an answer, so it can
 * be tested exhaustively without a database and cannot be talked into a
 * different price by anything a browser sends.
 *
 * The rule that matters: the browser posts IDS. It never posts an amount. The
 * server looks each id up, prices it here, and compares the result with what
 * the payment provider says it captured.
 */

export interface PricedProduct {
  id: string;
  kind: 'module' | 'cursus';
  courseId: string | null;
  cursusId: string | null;
  yearIndex: number;
  delivery: DeliveryMode;
  priceCents: number;
  durationDays: number;
  title: string;
}

export interface OfferPack {
  id: string;
  slug: string;
  title: string;
  delivery: DeliveryMode;
  pricing: PackPricing;
  priceCents: number | null;
  percentOff: number | null;
  /** Product ids the pack charges for. */
  paidProductIds: string[];
  /** Product ids the pack throws in. */
  freeProductIds: string[];
}

export interface AppliedCoupon {
  id: string;
  code: string;
  percentOff: number | null;
  amountOffCents: number | null;
}

export interface QuoteLine {
  productId: string;
  title: string;
  kind: 'module' | 'cursus';
  courseId: string | null;
  cursusId: string | null;
  yearIndex: number;
  delivery: DeliveryMode;
  /** What this line is charged. Zero when an offer throws it in. */
  unitPriceCents: number;
  /** The price before the offer, so the student can see what they saved. */
  listPriceCents: number;
  durationDays: number;
  isFree: boolean;
}

export interface Quote {
  lines: QuoteLine[];
  subtotalCents: number;
  /** The offer's contribution, already inside `subtotalCents`. */
  packDiscountCents: number;
  /** The coupon's contribution, taken off the subtotal. */
  couponDiscountCents: number;
  discountCents: number;
  totalCents: number;
  currency: string;
  pack: OfferPack | null;
  coupon: AppliedCoupon | null;
}

const CURRENCY = 'EUR';

/**
 * Does this offer apply to what the student has chosen?
 *
 *   * `sum` packs — the "buy Arabic, get French free" shape — apply to any
 *     selection that CONTAINS the pack. Picking a third module on top should
 *     not take the offer away.
 *   * `fixed` and `percent` packs need an exact match. "Three modules for
 *     500 €" applied to a five-module basket has no defensible answer, so it
 *     is not applied at all rather than guessed at.
 */
export function packApplies(pack: OfferPack, selectedIds: readonly string[]): boolean {
  const selected = new Set(selectedIds);
  const members = [...pack.paidProductIds, ...pack.freeProductIds];
  if (members.length === 0) return false;
  if (!members.every((id) => selected.has(id))) return false;

  if (pack.pricing === 'sum') return true;
  return members.length === selected.size;
}

/** What an offer takes off, in cents. Never more than the basket is worth. */
function packDiscount(pack: OfferPack, products: readonly PricedProduct[]): number {
  const listTotal = products.reduce((n, p) => n + p.priceCents, 0);

  switch (pack.pricing) {
    case 'sum': {
      const free = new Set(pack.freeProductIds);
      return products.filter((p) => free.has(p.id)).reduce((n, p) => n + p.priceCents, 0);
    }
    case 'percent':
      return Math.round((listTotal * (pack.percentOff ?? 0)) / 100);
    case 'fixed':
      return Math.max(0, listTotal - (pack.priceCents ?? listTotal));
  }
}

/**
 * The offer that leaves the student best off.
 *
 * Ties break on slug so the choice is stable across requests — a total that
 * flickers between two equal offers on a page refresh reads as a bug.
 */
export function bestPack(
  packs: readonly OfferPack[],
  products: readonly PricedProduct[],
  delivery: DeliveryMode,
): OfferPack | null {
  const ids = products.map((p) => p.id);
  const eligible = packs.filter((p) => p.delivery === delivery && packApplies(p, ids));
  if (eligible.length === 0) return null;

  return eligible.reduce((best, pack) => {
    const a = packDiscount(pack, products);
    const b = packDiscount(best, products);
    if (a !== b) return a > b ? pack : best;
    return pack.slug < best.slug ? pack : best;
  });
}

/** What a coupon takes off a given subtotal. Never more than the subtotal. */
export function couponDiscount(coupon: AppliedCoupon, subtotalCents: number): number {
  const raw =
    coupon.percentOff !== null
      ? Math.round((subtotalCents * coupon.percentOff) / 100)
      : (coupon.amountOffCents ?? 0);
  return Math.min(Math.max(0, raw), subtotalCents);
}

/**
 * Price a selection.
 *
 * `products` must already be filtered to published rows in the chosen delivery
 * mode — this function prices what it is handed and does not re-check
 * publication, because the caller reads through RLS and a draft product never
 * reaches it.
 */
export function priceSelection(options: {
  products: readonly PricedProduct[];
  packs?: readonly OfferPack[];
  delivery: DeliveryMode;
  coupon?: AppliedCoupon | null;
}): Quote {
  const { products, packs = [], delivery, coupon = null } = options;

  const pack = bestPack(packs, products, delivery);
  const freeIds = new Set(pack?.pricing === 'sum' ? pack.freeProductIds : []);

  // A `sum` pack zeroes specific lines, so the saving is visible against the
  // item that was thrown in. `fixed` and `percent` packs price the basket as a
  // whole, so they come off the subtotal instead.
  const lines: QuoteLine[] = products.map((product) => {
    const isFree = freeIds.has(product.id);
    return {
      productId: product.id,
      title: product.title,
      kind: product.kind,
      courseId: product.courseId,
      cursusId: product.cursusId,
      yearIndex: product.yearIndex,
      delivery: product.delivery,
      unitPriceCents: isFree ? 0 : product.priceCents,
      listPriceCents: product.priceCents,
      durationDays: product.durationDays,
      isFree,
    };
  });

  const subtotalCents = lines.reduce((n, l) => n + l.unitPriceCents, 0);
  const listTotal = lines.reduce((n, l) => n + l.listPriceCents, 0);

  const wholeBasketDiscount =
    pack && pack.pricing !== 'sum' ? Math.min(packDiscount(pack, products), subtotalCents) : 0;

  const afterPack = subtotalCents - wholeBasketDiscount;
  const couponCents = coupon ? couponDiscount(coupon, afterPack) : 0;

  return {
    lines,
    subtotalCents,
    // What the offer saved overall, whichever shape it took.
    packDiscountCents: pack ? listTotal - subtotalCents + wholeBasketDiscount : 0,
    couponDiscountCents: couponCents,
    discountCents: wholeBasketDiscount + couponCents,
    totalCents: afterPack - couponCents,
    currency: CURRENCY,
    pack,
    coupon,
  };
}

/** Cents to a display string, in the reader's locale. */
export function formatPrice(cents: number, locale: string, currency = CURRENCY): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
  }).format(cents / 100);
}
