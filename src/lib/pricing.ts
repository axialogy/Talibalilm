import type { Product, PriceTier, StoreSettings } from '@/types';

/**
 * The currency symbol is an admin setting, so it lives in a module variable
 * that the store updates on load. Formatting helpers are called from render
 * paths all over the app and must stay synchronous.
 */
let currencySymbol = 'DA';

export function setCurrencySymbol(symbol: string): void {
  if (symbol.trim()) currencySymbol = symbol.trim();
}

export function getCurrencySymbol(): string {
  return currencySymbol;
}

/** "3 200 DA" — grouped with the French locale, which Algeria uses. */
export function formatPrice(amount: number): string {
  return `${Math.round(amount).toLocaleString('fr-DZ')} ${currencySymbol}`;
}

/**
 * Best price for `quantity` units.
 *
 * Offers are bundles ("2 for 5800"), so the cheapest total is found by
 * taking as many of the largest worthwhile bundle as fit, then pricing the
 * remainder the same way. Falls back to unit price × quantity when the
 * product has no offers.
 */
export function computeTotal(product: Product, quantity: number): number {
  const offers = (product.offers ?? []).filter(o => o.qty > 0 && o.price > 0);
  if (offers.length === 0 || quantity <= 0) {
    return product.price * Math.max(quantity, 0);
  }

  // Largest bundle first, so the greedy pass takes the best deal available.
  const tiers: PriceTier[] = [...offers].sort((a, b) => b.qty - a.qty);

  let remaining = quantity;
  let total = 0;
  for (const tier of tiers) {
    if (remaining < tier.qty) continue;
    const bundles = Math.floor(remaining / tier.qty);
    total += bundles * tier.price;
    remaining -= bundles * tier.qty;
  }
  total += remaining * product.price;

  // A bundle should never cost more than buying the units outright.
  return Math.min(total, product.price * quantity);
}

/** Effective per-unit price at a given quantity, used for "X DA each" labels. */
export function unitPriceAt(product: Product, quantity: number): number {
  if (quantity <= 0) return product.price;
  return computeTotal(product, quantity) / quantity;
}

/** Percentage off, rounded. Returns 0 when there is no old price. */
export function discountPercent(product: Product): number {
  if (!product.oldPrice || product.oldPrice <= product.price) return 0;
  return Math.round(((product.oldPrice - product.price) / product.oldPrice) * 100);
}

/**
 * Delivery cost for a cart. Free above the threshold when the admin set one.
 */
export function deliveryFeeFor(
  subtotal: number,
  method: 'home' | 'desk',
  settings: Pick<StoreSettings, 'deliveryHome' | 'deliveryDesk' | 'freeDeliveryOver'>,
): number {
  if (settings.freeDeliveryOver > 0 && subtotal >= settings.freeDeliveryOver) return 0;
  return method === 'home' ? settings.deliveryHome : settings.deliveryDesk;
}
