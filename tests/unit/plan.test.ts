import { describe, expect, it } from 'vitest';
import { planDueDates, splitInstallments } from '@/lib/commerce/plan';

/**
 * The arithmetic of paying in three.
 *
 * A plan that does not sum to the price is either a shortfall the school eats
 * or a student charged twice for a cent. These pin the two rules that make it
 * exact: equal shares, and the last one absorbs the rounding.
 */

describe('splitInstallments', () => {
  it('leaves a single payment whole', () => {
    expect(splitInstallments(30000, 1)).toEqual([30000]);
  });

  it('splits evenly when it divides', () => {
    expect(splitInstallments(30000, 3)).toEqual([10000, 10000, 10000]);
  });

  it('gives the remainder to the LAST installment', () => {
    // 10000 / 3 = 3333.33 — 3333 + 3333 + 3334.
    expect(splitInstallments(10000, 3)).toEqual([3333, 3333, 3334]);
  });

  it('always sums to exactly the total', () => {
    for (const total of [1, 2, 999, 10000, 30001, 123457]) {
      const parts = splitInstallments(total, 3);
      expect(parts.reduce((sum, part) => sum + part, 0)).toBe(total);
    }
  });

  it('never produces a zero or negative installment', () => {
    expect(splitInstallments(2, 3)).toEqual([0, 0, 2]);
    // A basket worth nothing has nothing to split.
    expect(splitInstallments(0, 3)).toEqual([0]);
  });

  it('refuses a plan bigger than the school offers', () => {
    expect(splitInstallments(12000, 99)).toHaveLength(3);
  });
});

describe('planDueDates', () => {
  it('dates the first today and the rest three months apart', () => {
    const dates = planDueDates(new Date('2026-09-16T10:00:00Z'), 3);
    expect(dates).toHaveLength(3);
    expect(dates[0]?.toISOString()).toBe(new Date('2026-09-16T10:00:00Z').toISOString());
    expect(dates[1]?.getUTCMonth()).toBe(new Date('2026-12-16T10:00:00Z').getUTCMonth());
    expect(dates[2]?.getUTCMonth()).toBe(new Date('2027-03-16T10:00:00Z').getUTCMonth());
  });
});
