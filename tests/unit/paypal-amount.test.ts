import { describe, expect, it } from 'vitest';
import { fromPayPalAmount, toPayPalAmount } from '../../src/lib/paypal/amount';

/**
 * The capture is only accepted when the amount PayPal reports matches the
 * order row exactly. That comparison is worth nothing if the conversion into
 * and out of PayPal's decimal strings is loose, so it is pinned here.
 */
describe('cents to PayPal', () => {
  it('always writes two decimal places', () => {
    expect(toPayPalAmount(30000)).toBe('300.00');
    expect(toPayPalAmount(49000)).toBe('490.00');
    expect(toPayPalAmount(0)).toBe('0.00');
  });

  it('keeps a trailing zero rather than dropping it', () => {
    // "300.5" is not a valid PayPal amount; "300.50" is.
    expect(toPayPalAmount(30050)).toBe('300.50');
  });

  it('does not lose a single cent', () => {
    expect(toPayPalAmount(1)).toBe('0.01');
    expect(toPayPalAmount(99)).toBe('0.99');
    expect(toPayPalAmount(101)).toBe('1.01');
  });

  it('handles an amount past the float-precision range for money', () => {
    expect(toPayPalAmount(123_456_789)).toBe('1234567.89');
  });
});

describe('PayPal to cents', () => {
  it('reads what it wrote', () => {
    for (const cents of [0, 1, 99, 100, 30000, 30050, 123_456_789]) {
      expect(fromPayPalAmount(toPayPalAmount(cents))).toBe(cents);
    }
  });

  it('accepts one decimal place, which PayPal does send', () => {
    expect(fromPayPalAmount('300.5')).toBe(30050);
    expect(fromPayPalAmount('300')).toBe(30000);
  });

  it('refuses anything it cannot read rather than guessing zero', () => {
    // A null fails the equality check against the order total, so a garbled
    // amount can never settle an order. Returning 0 would settle a free one.
    for (const bad of ['', 'abc', '300.123', '-300.00', '3e2', '300,00', ' 300.00']) {
      expect(fromPayPalAmount(bad)).toBeNull();
    }
  });
});
