/**
 * Splitting a price into installments.
 *
 * Pure on purpose: the split is money, and money gets tested. It is also
 * shared by the checkout (which shows the three amounts before anything is
 * created) and by `createPendingOrder` (which writes them) — one function, so
 * the figure on the screen and the figure in the database cannot drift.
 */

/**
 * Equal shares, with the LAST one absorbing the rounding.
 *
 * Rounding each share and hoping is how a plan ends up a cent short and never
 * closes; the last installment is the only one that can make the sum exact.
 */
export function splitInstallments(totalCents: number, planSize: number): number[] {
  const size = Math.min(Math.max(1, Math.trunc(planSize)), 3);
  if (size === 1 || totalCents <= 0) return [totalCents];
  const base = Math.floor(totalCents / size);
  return Array.from({ length: size }, (_, index) =>
    index === size - 1 ? totalCents - base * (size - 1) : base,
  );
}

/** The day each installment falls due: the first today, then three months apart. */
export function planDueDates(from: Date, planSize: number): Date[] {
  const size = Math.min(Math.max(1, Math.trunc(planSize)), 3);
  return Array.from({ length: size }, (_, index) => {
    if (index === 0) return new Date(from);
    const date = new Date(from);
    date.setMonth(date.getMonth() + 3 * index);
    return date;
  });
}
