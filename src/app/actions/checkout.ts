'use server';

import { z } from 'zod';
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
 * Each action validates what it was handed and writes ids to the cookie. None
 * of them accepts a price, and none of them decides one — that is
 * `priceSelection`, run fresh on every render.
 *
 * None of them redirects either, and that is the point. The five steps are one
 * card on one page now; finishing a step must refresh what the card is showing
 * without taking the page out from under the reader. A Server Action already
 * re-renders the route it was called from, so returning is enough — the wizard
 * sees the new `furthest` and moves itself on.
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
  if (!parsed.success) return;

  const current = await readSelection();
  // Changing cursus invalidates everything downstream: the products on offer
  // are different, so keeping the old ids would price a basket the student can
  // no longer see.
  const next: Selection =
    current.cursusId === parsed.data.cursusId
      ? { ...current, ...parsed.data }
      : { ...EMPTY_SELECTION, ...parsed.data };

  await writeSelection(next);
}

export async function chooseDelivery(formData: FormData): Promise<void> {
  const parsed = deliverySchema.safeParse({ delivery: formData.get('delivery') });
  if (!parsed.success) return;

  const current = await readSelection();
  // Prices and programmes are per delivery mode, so switching modes drops the
  // basket rather than carrying ids that belong to the other price list.
  const next: Selection =
    current.delivery === parsed.data.delivery
      ? { ...current, ...parsed.data }
      : { ...current, ...parsed.data, productIds: [] };

  await writeSelection(next);
}

/**
 * Add or remove one module from the basket.
 *
 * The id is checked against the published price list for the chosen delivery
 * mode before it is stored, so a hand-posted id for a draft product — or for
 * the other mode's price — never reaches the quote.
 */
export async function toggleProduct(formData: FormData): Promise<void> {
  const productId = z.string().uuid().safeParse(formData.get('productId'));
  const selection = await readSelection();

  const { delivery } = selection;
  if (!productId.success || !delivery) return;

  const offered = await listProducts(delivery);
  const id = productId.data;
  if (!offered.some((p) => p.id === id)) return;

  const chosen = new Set(selection.productIds);
  if (chosen.has(id)) chosen.delete(id);
  else chosen.add(id);

  await writeSelection({ ...selection, productIds: [...chosen] });
}

/** The Approfondi route: one product, the year being enrolled in. */
export async function chooseCursusYear(formData: FormData): Promise<void> {
  const productId = z.string().uuid().safeParse(formData.get('productId'));
  const selection = await readSelection();

  const { delivery } = selection;
  if (!productId.success || !delivery) return;

  const offered = await listProducts(delivery);
  const product = offered.find((p) => p.id === productId.data);
  if (!product || product.kind !== 'cursus') return;

  await writeSelection({
    ...selection,
    productIds: [product.id],
    yearIndex: product.yearIndex,
  });
}

export async function applyCoupon(formData: FormData): Promise<void> {
  const raw = z.string().max(32).safeParse(formData.get('code'));
  const selection = await readSelection();

  // Stored, not validated. A coupon is checked and spent server-side at the
  // moment of payment; telling the student here whether a code exists would
  // turn the review step into an oracle for guessing them.
  await writeSelection({
    ...selection,
    couponCode: raw.success && raw.data.trim() !== '' ? raw.data.trim().toUpperCase() : null,
  });
}

export async function resetCheckout(): Promise<void> {
  await writeSelection(EMPTY_SELECTION);
}

/**
 * Start the flow already holding one module.
 *
 * The enrolment card on a module's page is the same wizard, opened with that
 * module in the basket — the student should not have to find in a list the
 * thing whose page they are standing on. The id still goes through the
 * published price list before it is stored.
 */
export async function selectModuleProduct(formData: FormData): Promise<void> {
  const parsed = z
    .object({
      productId: z.string().uuid(),
      delivery: z.enum(['presentiel', 'online']),
      cursusId: z.string().uuid().nullable().catch(null),
    })
    .safeParse({
      productId: formData.get('productId'),
      delivery: formData.get('delivery'),
      cursusId: formData.get('cursusId') || null,
    });
  if (!parsed.success) return;

  const { productId, delivery, cursusId } = parsed.data;
  const offered = await listProducts(delivery);
  const product = offered.find((p) => p.id === productId && p.kind === 'module');
  if (!product) return;

  const current = await readSelection();
  await writeSelection({
    ...current,
    kind: 'module',
    cursusId: cursusId ?? current.cursusId,
    delivery,
    productIds: [product.id],
  });
}
