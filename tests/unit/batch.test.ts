import { describe, expect, it } from 'vitest';
import { slugifyBatch } from '@/lib/commerce/batch';

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
