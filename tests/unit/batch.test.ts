import { describe, expect, it } from 'vitest';
import { normalisePrefix, slugifyBatch } from '@/lib/commerce/batch';

describe('slugifyBatch', () => {
  it('accepts what the office actually types', () => {
    // The exact input that used to be refused.
    expect(slugifyBatch('october 2026')).toBe('october-2026');
    expect(slugifyBatch('October 2026')).toBe('october-2026');
    expect(slugifyBatch('Rentrée Septembre 2026')).toBe('rentree-septembre-2026');
  });

  it('leaves an already-tidy name alone', () => {
    expect(slugifyBatch('sept-2026')).toBe('sept-2026');
  });

  it('collapses punctuation rather than stacking hyphens', () => {
    expect(slugifyBatch('caisse — septembre / 2026')).toBe('caisse-septembre-2026');
    expect(slugifyBatch('  spaced  out  ')).toBe('spaced-out');
  });

  it('never leaves a leading or trailing hyphen', () => {
    expect(slugifyBatch('---hello---')).toBe('hello');
    expect(slugifyBatch('!!!')).toBe('');
  });

  it('stays within the column width without ending mid-hyphen', () => {
    const long = slugifyBatch('a'.repeat(80));
    expect(long.length).toBeLessThanOrEqual(60);
    expect(long.endsWith('-')).toBe(false);
  });
});

describe('normalisePrefix', () => {
  it('upper-cases what the desk types', () => {
    expect(normalisePrefix('pay')).toBe('PAY');
    expect(normalisePrefix('caisse')).toBe('CAISSE');
  });

  it('drops anything the coupon code shape would refuse', () => {
    expect(normalisePrefix('pay-2026!')).toBe('PAY2026');
    expect(normalisePrefix('Été')).toBe('ETE');
    expect(normalisePrefix('  ')).toBe('');
  });

  it('caps the length so the generated code still fits', () => {
    expect(normalisePrefix('A'.repeat(40)).length).toBe(12);
  });
});
