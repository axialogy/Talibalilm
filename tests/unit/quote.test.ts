import { describe, expect, it } from 'vitest';
import {
  bestPack,
  couponDiscount,
  currencyOf,
  formatPrice,
  MixedCurrencyError,
  packApplies,
  priceSelection,
  type OfferPack,
  type PricedProduct,
} from '../../src/lib/commerce/quote';

/**
 * A wrong price is the most expensive bug this codebase can have: it either
 * overcharges a student or hands away a year of teaching. These tests are the
 * reason the pricing function is pure.
 */

const module_ = (id: string, priceCents: number, courseId = `course-${id}`): PricedProduct => ({
  id,
  kind: 'module',
  courseId,
  cursusId: null,
  yearIndex: 1,
  delivery: 'online',
  priceCents,
  currency: 'EUR',
  durationDays: 365,
  title: `Module ${id}`,
});

const ARABIC = module_('arabic', 22000);
const FRENCH = module_('french', 18000);
const FIQH = module_('fiqh', 20000);

const bogof: OfferPack = {
  id: 'p1',
  slug: 'arabe-offert',
  title: 'Arabic + a free module',
  delivery: 'online',
  pricing: 'sum',
  priceCents: null,
  percentOff: null,
  paidProductIds: ['arabic'],
  freeProductIds: ['french'],
};

describe('offer eligibility', () => {
  it('applies a buy-one-get-one to the exact pair', () => {
    expect(packApplies(bogof, ['arabic', 'french'])).toBe(true);
  });

  it('still applies when the student adds a third module', () => {
    // Taking the offer away because someone bought more would be perverse.
    expect(packApplies(bogof, ['arabic', 'french', 'fiqh'])).toBe(true);
  });

  it('does not apply when the free half was not selected', () => {
    expect(packApplies(bogof, ['arabic'])).toBe(false);
  });

  it('does not apply when the paid half was not selected', () => {
    expect(packApplies(bogof, ['french'])).toBe(false);
  });

  it('requires an exact basket for a fixed-price bundle', () => {
    const threeForFive: OfferPack = {
      ...bogof,
      id: 'p2',
      slug: 'trois-modules',
      pricing: 'fixed',
      priceCents: 50000,
      paidProductIds: ['arabic', 'french', 'fiqh'],
      freeProductIds: [],
    };
    expect(packApplies(threeForFive, ['arabic', 'french', 'fiqh'])).toBe(true);
    // "Three for 500" against a four-module basket has no defensible answer.
    expect(packApplies(threeForFive, ['arabic', 'french', 'fiqh', 'extra'])).toBe(false);
    expect(packApplies(threeForFive, ['arabic', 'french'])).toBe(false);
  });

  it('ignores an empty pack', () => {
    expect(packApplies({ ...bogof, paidProductIds: [], freeProductIds: [] }, ['arabic'])).toBe(
      false,
    );
  });

  it('ignores an offer built for the other delivery mode', () => {
    const onsiteOnly: OfferPack = { ...bogof, delivery: 'presentiel' };
    expect(bestPack([onsiteOnly], [ARABIC, FRENCH], 'online')).toBeNull();
  });

  it('picks the offer that leaves the student best off', () => {
    const stingy: OfferPack = {
      ...bogof,
      id: 'p3',
      slug: 'petite-remise',
      pricing: 'percent',
      percentOff: 10,
      paidProductIds: ['arabic', 'french'],
      freeProductIds: [],
    };
    // bogof saves 18000; 10 % of 40000 saves 4000.
    expect(bestPack([stingy, bogof], [ARABIC, FRENCH], 'online')?.slug).toBe('arabe-offert');
  });

  it('breaks a tie on slug so the total does not flicker between refreshes', () => {
    const a: OfferPack = { ...bogof, id: 'a', slug: 'aaa' };
    const b: OfferPack = { ...bogof, id: 'b', slug: 'bbb' };
    expect(bestPack([b, a], [ARABIC, FRENCH], 'online')?.slug).toBe('aaa');
    expect(bestPack([a, b], [ARABIC, FRENCH], 'online')?.slug).toBe('aaa');
  });
});

describe('pricing a selection', () => {
  it('charges list price with no offer', () => {
    const quote = priceSelection({ products: [ARABIC], delivery: 'online' });
    expect(quote.subtotalCents).toBe(22000);
    expect(quote.discountCents).toBe(0);
    expect(quote.totalCents).toBe(22000);
    expect(quote.pack).toBeNull();
  });

  it('prices an empty selection at zero rather than throwing', () => {
    const quote = priceSelection({ products: [], delivery: 'online' });
    expect(quote.totalCents).toBe(0);
    expect(quote.lines).toEqual([]);
  });

  it('zeroes the free line of a buy-one-get-one and says what it saved', () => {
    const quote = priceSelection({
      products: [ARABIC, FRENCH],
      packs: [bogof],
      delivery: 'online',
    });

    expect(quote.lines.find((l) => l.productId === 'french')).toMatchObject({
      unitPriceCents: 0,
      listPriceCents: 18000,
      isFree: true,
    });
    expect(quote.subtotalCents).toBe(22000);
    expect(quote.packDiscountCents).toBe(18000);
    expect(quote.totalCents).toBe(22000);
  });

  it('keeps charging for modules the offer does not cover', () => {
    const quote = priceSelection({
      products: [ARABIC, FRENCH, FIQH],
      packs: [bogof],
      delivery: 'online',
    });
    expect(quote.totalCents).toBe(22000 + 20000);
  });

  it('takes a fixed-price bundle off the subtotal', () => {
    const bundle: OfferPack = {
      ...bogof,
      slug: 'trois-modules',
      pricing: 'fixed',
      priceCents: 50000,
      paidProductIds: ['arabic', 'french', 'fiqh'],
      freeProductIds: [],
    };
    const quote = priceSelection({
      products: [ARABIC, FRENCH, FIQH],
      packs: [bundle],
      delivery: 'online',
    });
    expect(quote.totalCents).toBe(50000);
    expect(quote.discountCents).toBe(60000 - 50000);
  });

  it('rounds a percentage to whole cents', () => {
    const odd: OfferPack = {
      ...bogof,
      slug: 'remise-impaire',
      pricing: 'percent',
      percentOff: 33,
      paidProductIds: ['odd'],
      freeProductIds: [],
    };
    const product = module_('odd', 10001);
    const quote = priceSelection({ products: [product], packs: [odd], delivery: 'online' });
    // 33 % of 10001 is 3300.33 — never a fraction of a cent in the total.
    expect(quote.discountCents).toBe(3300);
    expect(quote.totalCents).toBe(6701);
    expect(Number.isInteger(quote.totalCents)).toBe(true);
  });
});

describe('coupons', () => {
  const office = { id: 'c1', code: 'CAISSE-0001', percentOff: 100, amountOffCents: null };

  it('takes the office cash route to exactly zero', () => {
    const quote = priceSelection({ products: [ARABIC], delivery: 'online', coupon: office });
    expect(quote.totalCents).toBe(0);
    expect(quote.couponDiscountCents).toBe(22000);
  });

  it('never discounts below zero', () => {
    const huge = { id: 'c2', code: 'GROS', percentOff: null, amountOffCents: 999_999 };
    const quote = priceSelection({ products: [FRENCH], delivery: 'online', coupon: huge });
    expect(quote.totalCents).toBe(0);
    expect(quote.couponDiscountCents).toBe(18000);
  });

  it('applies after the offer, not before it', () => {
    // 22000 + 18000 with the free module = 22000; then half off = 11000.
    const half = { id: 'c3', code: 'MOITIE', percentOff: 50, amountOffCents: null };
    const quote = priceSelection({
      products: [ARABIC, FRENCH],
      packs: [bogof],
      delivery: 'online',
      coupon: half,
    });
    expect(quote.totalCents).toBe(11000);
  });

  it('caps an amount-off coupon at the subtotal in isolation', () => {
    expect(couponDiscount({ id: 'x', code: 'X', percentOff: null, amountOffCents: 5000 }, 3000))
      .toBe(3000);
  });
});

describe('formatting', () => {
  it('drops the decimals on a round price', () => {
    expect(formatPrice(22000, 'fr-FR').replace(/ | /g, ' ')).toBe('220 €');
  });

  it('keeps them when there are cents to show', () => {
    expect(formatPrice(22050, 'fr-FR').replace(/ | /g, ' ')).toBe('220,50 €');
  });
});

describe('currency (audit B2)', () => {
  it('takes the currency from the products, not a constant', () => {
    const chf = { ...ARABIC, currency: 'CHF' };
    expect(priceSelection({ products: [chf], delivery: 'online' }).currency).toBe('CHF');
  });

  it('refuses a basket that mixes currencies rather than picking one', () => {
    // There is no correct total for such a basket. Silently choosing was how a
    // student could be charged 300 of the wrong unit, with the check at
    // settlement comparing EUR against EUR and passing.
    expect(() =>
      priceSelection({ products: [ARABIC, { ...FRENCH, currency: 'CHF' }], delivery: 'online' }),
    ).toThrow(MixedCurrencyError);
  });

  it('names both currencies in the error, so the price list can be fixed', () => {
    try {
      currencyOf([ARABIC, { ...FRENCH, currency: 'GBP' }]);
      expect.unreachable();
    } catch (error) {
      expect((error as MixedCurrencyError).currencies.sort()).toEqual(['EUR', 'GBP']);
    }
  });

  it('falls back only when there is nothing to read a currency from', () => {
    expect(priceSelection({ products: [], delivery: 'online' }).currency).toBe('EUR');
  });

  it('formats in the basket’s own currency', () => {
    const quote = priceSelection({
      products: [{ ...ARABIC, currency: 'CHF' }],
      delivery: 'online',
    });
    expect(formatPrice(quote.totalCents, 'fr-FR', quote.currency)).toMatch(/CHF/);
  });
});

describe('a course the school gives away', () => {
  it('says "Free" rather than a price of nought', () => {
    // "€0.00" reads like a form that failed to load, not like an invitation.
    expect(formatPrice(0, 'en')).toBe('Free');
    expect(formatPrice(0, 'fr')).toBe('Gratuit');
    expect(formatPrice(0, 'en-GB', 'GBP')).toBe('Free');
  });

  it('still prices everything above zero as money', () => {
    expect(formatPrice(1, 'en')).not.toBe('Free');
    expect(formatPrice(30000, 'en')).not.toBe('Free');
  });
});
