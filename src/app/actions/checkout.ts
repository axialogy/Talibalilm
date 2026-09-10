'use server';

import { z } from 'zod';
import { redirect } from '@/i18n/navigation';
import { getLocale } from 'next-intl/server';
import {
  EMPTY_SELECTION,
  readSelection,
  writeSelection,
  type Selection,
} from '@/lib/commerce/selection';
import { listProducts } from '@/lib/data/commerce';

/**
 * The checkout steps.
 *
 * Each action validates what it was handed, writes ids to the cookie, and
 * redirects to the next step. None of them accepts a price, and none of them
 * decides one — that is `priceSelection`, run fresh on every render.
 */

const kindSchema = z.object({
  kind: z.enum(['module', 'approfondi']),
  cursusId: z.string().uuid(),
});

const deliverySchema = z.object({ delivery: z.enum(['presentiel', 'online']) });

export async function chooseCursus(formData: FormData): Promise<void> {
  const parsed = kindSchema.safeParse({
    kind: formData.get('kind'),
    cursusId: formData.get('cursusId'),
  });
  if (!parsed.success) return redirect({ href: '/checkout', locale: await getLocale() });

  const current = await readSelection();
  // Changing cursus invalidates everything downstream: the products on offer
  // are different, so keeping the old ids would price a basket the student can
  // no longer see.
  const next: Selection =
    current.cursusId === parsed.data.cursusId
      ? { ...current, ...parsed.data }
      : { ...EMPTY_SELECTION, ...parsed.data };

  await writeSelection(next);
  return redirect({ href: '/checkout/mode', locale: await getLocale() });
}

export async function chooseDelivery(formData: FormData): Promise<void> {
  const parsed = deliverySchema.safeParse({ delivery: formData.get('delivery') });
  if (!parsed.success) return redirect({ href: '/checkout/mode', locale: await getLocale() });

  const current = await readSelection();
  // Prices and programmes are per delivery mode, so switching modes drops the
  // basket rather than carrying ids that belong to the other price list.
  const next: Selection =
    current.delivery === parsed.data.delivery
      ? { ...current, ...parsed.data }
      : { ...current, ...parsed.data, productIds: [] };

  await writeSelection(next);
  return redirect({ href: '/checkout/modules', locale: await getLocale() });
}

/**
 * Add or remove one module from the basket.
 *
 * The id is checked against the published price list for the chosen delivery
 * mode before it is stored, so a hand-posted id for a draft product — or for
 * the other mode's price — never reaches the quote.
 */
export async function toggleProduct(formData: FormData): Promise<void> {
  const locale = await getLocale();
  const productId = z.string().uuid().safeParse(formData.get('productId'));
  const selection = await readSelection();

  const { delivery } = selection;
  if (!productId.success || !delivery) {
    return redirect({ href: '/checkout/modules', locale });
  }

  const offered = await listProducts(delivery);
  const id = productId.data;
  if (!offered.some((p) => p.id === id)) {
    return redirect({ href: '/checkout/modules', locale });
  }

  const chosen = new Set(selection.productIds);
  if (chosen.has(id)) chosen.delete(id);
  else chosen.add(id);

  await writeSelection({ ...selection, productIds: [...chosen] });
  return redirect({ href: '/checkout/modules', locale });
}

/** The Approfondi route: one product, the year being enrolled in. */
export async function chooseCursusYear(formData: FormData): Promise<void> {
  const locale = await getLocale();
  const productId = z.string().uuid().safeParse(formData.get('productId'));
  const selection = await readSelection();

  const { delivery } = selection;
  if (!productId.success || !delivery) {
    return redirect({ href: '/checkout/modules', locale });
  }

  const offered = await listProducts(delivery);
  const product = offered.find((p) => p.id === productId.data);
  if (!product || product.kind !== 'cursus') {
    return redirect({ href: '/checkout/modules', locale });
  }

  await writeSelection({
    ...selection,
    productIds: [product.id],
    yearIndex: product.yearIndex,
  });
  return redirect({ href: '/checkout/review', locale });
}

export async function applyCoupon(formData: FormData): Promise<void> {
  const locale = await getLocale();
  const raw = z.string().max(32).safeParse(formData.get('code'));
  const selection = await readSelection();

  // Stored, not validated. A coupon is checked and spent server-side at the
  // moment of payment; telling the student here whether a code exists would
  // turn the review page into an oracle for guessing them.
  await writeSelection({
    ...selection,
    couponCode: raw.success && raw.data.trim() !== '' ? raw.data.trim().toUpperCase() : null,
  });
  return redirect({ href: '/checkout/review', locale });
}

export async function resetCheckout(): Promise<void> {
  await writeSelection(EMPTY_SELECTION);
  return redirect({ href: '/checkout', locale: await getLocale() });
}
