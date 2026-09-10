import { cookies } from 'next/headers';
import { z } from 'zod';

/**
 * What the student has chosen so far, carried between the checkout steps.
 *
 * It lives in a cookie rather than a database row, and it is deliberately NOT
 * signed. Nothing here is trusted: the cookie holds ids, and every step reads
 * those ids back out of the catalogue and prices them server-side. The worst a
 * tampered cookie can do is select a different published product — which is
 * what the buttons on the page do anyway.
 *
 * The thing that must never appear in here is an amount.
 */
export const selectionSchema = z.object({
  cursusId: z.string().uuid().nullable().default(null),
  kind: z.enum(['module', 'approfondi']).nullable().default(null),
  delivery: z.enum(['presentiel', 'online']).nullable().default(null),
  yearIndex: z.number().int().min(1).max(10).default(1),
  productIds: z.array(z.string().uuid()).max(20).default([]),
  couponCode: z.string().max(32).nullable().default(null),
});

export type Selection = z.infer<typeof selectionSchema>;

export const EMPTY_SELECTION: Selection = {
  cursusId: null,
  kind: null,
  delivery: null,
  yearIndex: 1,
  productIds: [],
  couponCode: null,
};

const COOKIE = 'tal_checkout';
/** Long enough to read a programme and think about it, short enough to forget. */
const MAX_AGE_SECONDS = 60 * 60 * 4;

export async function readSelection(): Promise<Selection> {
  const raw = (await cookies()).get(COOKIE)?.value;
  if (!raw) return EMPTY_SELECTION;

  try {
    const parsed = selectionSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : EMPTY_SELECTION;
  } catch {
    // A malformed cookie is a fresh start, never an error page.
    return EMPTY_SELECTION;
  }
}

/** Only callable from a Server Action or a Route Handler. */
export async function writeSelection(selection: Selection): Promise<void> {
  (await cookies()).set(COOKIE, JSON.stringify(selection), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: MAX_AGE_SECONDS,
  });
}

export async function clearSelection(): Promise<void> {
  (await cookies()).delete(COOKIE);
}

/**
 * How far the student has got, and therefore which step may be shown.
 *
 * Returned rather than checked at each page, so a deep link to step four with
 * an empty cookie sends the visitor back to step one instead of rendering a
 * form with nothing in it.
 */
export function furthestStep(selection: Selection): 1 | 2 | 3 | 4 {
  if (!selection.kind) return 1;
  if (!selection.delivery) return 2;
  if (selection.productIds.length === 0) return 3;
  return 4;
}
