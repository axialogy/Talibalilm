import { describe, expect, it } from 'vitest';
import { pickFreeSlug, slugify } from '@/lib/content/slug';

describe('slugify', () => {
  it('turns a course title into an address', () => {
    expect(slugify('Fiqh al-Ibadat')).toBe('fiqh-al-ibadat');
    expect(slugify('Aqīda — Année 1')).toBe('aqida-annee-1');
  });

  it('collapses punctuation instead of stacking hyphens', () => {
    expect(slugify('  Coran / Tajwid  ')).toBe('coran-tajwid');
    expect(slugify('!!!')).toBe('');
  });

  it('stays inside the column and never ends mid-hyphen', () => {
    const long = slugify('a'.repeat(200));
    expect(long.length).toBeLessThanOrEqual(80);
    expect(long.endsWith('-')).toBe(false);
  });
});

describe('pickFreeSlug', () => {
  it('uses the plain slug when it is free', () => {
    expect(pickFreeSlug('fiqh', [])).toBe('fiqh');
  });

  it('numbers a repeated title rather than refusing the save', () => {
    expect(pickFreeSlug('annee-1', ['annee-1'])).toBe('annee-1-2');
    expect(pickFreeSlug('annee-1', ['annee-1', 'annee-1-2'])).toBe('annee-1-3');
  });

  it('skips gaps left by deleted records', () => {
    expect(pickFreeSlug('annee-1', ['annee-1', 'annee-1-3'])).toBe('annee-1-2');
  });

  it('falls back when the title carries no latin characters at all', () => {
    expect(pickFreeSlug(slugify('العقيدة'), [], 'cours')).toBe('cours');
    expect(pickFreeSlug(slugify('العقيدة'), ['cours'], 'cours')).toBe('cours-2');
  });
});
