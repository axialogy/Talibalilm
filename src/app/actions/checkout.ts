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

const deliverySchema = z.object({
  delivery: z.enum(['presentiel', 'online']),
  /**
   * Present when the card sits on a module's page. The module is then already
   * chosen, and the answer carries it so the action does not depend on a
   * previous click having written the cookie.
   */
  courseId: z.string().uuid().nullable().catch(null),
  cursusId: z.string().uuid().nullable().catch(null),
  kind: z.enum(['module', 'approfondi']).nullable().catch(null),
});

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
  const parsed = deliverySchema.safeParse({
    delivery: formData.get('delivery'),
    courseId: formData.get('courseId'),
    cursusId: formData.get('cursusId'),
    kind: formData.get('kind'),
  });
  if (!parsed.success) return;

  const current = await readSelection();

  const kind = parsed.data.kind ?? current.kind;
  const cursusId = parsed.data.cursusId ?? current.cursusId;
  const courseId = parsed.data.courseId ?? current.courseId;

  // Prices and programmes are per delivery mode, so switching modes drops the
  // basket rather than carrying ids that belong to the other price list.
  let productIds = current.delivery === parsed.data.delivery ? current.productIds : [];

  // The enrol card on a module's page holds the COURSE, not a product, because
  // a product belongs to one mode. Now that the mode is answered, the course
  // becomes the matching product here — so the student does not then have to
  // find that same module in a list of everything the school sells. The id is
  // checked against the published price list first, exactly as a hand-posted
  // one would be.
  //
  // `courseId` stays on the selection: it is what tells the module's own page
  // that this basket belongs to it, and switching mode re-resolves it against
  // the other price list.
  if (kind === 'module' && courseId) {
    const offered = await listProducts(parsed.data.delivery);
    const match = offered.find((p) => p.kind === 'module' && p.courseId === courseId);
    if (match) productIds = [match.id];
  }

  await writeSelection({
    ...current,
    kind,
    cursusId,
    delivery: parsed.data.delivery,
    productIds,
    courseId,
  });
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
