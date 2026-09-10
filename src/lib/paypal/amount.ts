/**
 * Money across the PayPal boundary.
 *
 * Split out from the client so it can be tested without pulling in
 * `server-only`. It is the smallest piece of this integration and the one
 * where a mistake is measured in euros: PayPal speaks decimal strings, this
 * codebase speaks integer cents, and no float is allowed between them.
 */

/** Cents to the decimal string PayPal insists on. */
export function toPayPalAmount(cents: number): string {
  const sign = cents < 0 ? '-' : '';
  const abs = Math.abs(Math.trunc(cents));
  return `${sign}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, '0')}`;
}

/**
 * The decimal string back to cents, for checking what PayPal says it took.
 *
 * Null for anything that is not a plain non-negative decimal with at most two
 * places. A value that cannot be read is never treated as zero — the caller
 * compares it against the order total, and null fails that comparison.
 */
export function fromPayPalAmount(value: string): number | null {
  if (!/^\d+(\.\d{1,2})?$/.test(value)) return null;
  const [whole, fraction = ''] = value.split('.');
  return Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
}
