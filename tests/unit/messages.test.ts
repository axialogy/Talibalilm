import { describe, expect, it } from 'vitest';
import fr from '../../messages/fr.json';
import en from '../../messages/en.json';

/**
 * The spec requires every string to live in a message file from day one. The
 * failure mode that actually bites is a key added to one locale and forgotten
 * in the other: next-intl then falls back to the key itself and the page shows
 * `home.hero.title` to a reader. These tests make that a red build.
 */
type Tree = { [key: string]: string | Tree };

function flatten(tree: Tree, prefix = ''): Map<string, string> {
  const out = new Map<string, string>();
  for (const [key, value] of Object.entries(tree)) {
    const path = `${prefix}${key}`;
    if (typeof value === 'string') out.set(path, value);
    else for (const [k, v] of flatten(value, `${path}.`)) out.set(k, v);
  }
  return out;
}

const catalogues = {
  fr: flatten(fr as Tree),
  en: flatten(en as Tree),
};

const reference = catalogues.fr;
const others = Object.entries(catalogues).filter(([code]) => code !== 'fr');

describe('message catalogues', () => {
  it('define the same keys in every locale', () => {
    const gaps = Object.fromEntries(
      others.map(([code, flat]) => [
        code,
        {
          missing: [...reference.keys()].filter((k) => !flat.has(k)),
          extra: [...flat.keys()].filter((k) => !reference.has(k)),
        },
      ]),
    );
    for (const [, gap] of Object.entries(gaps)) expect(gap).toEqual({ missing: [], extra: [] });
  });

  it('leave no value empty', () => {
    const blank = Object.values(catalogues)
      .flatMap((flat) => [...flat])
      .filter(([, v]) => v.trim() === '')
      .map(([k]) => k);
    expect(blank).toEqual([]);
  });

  it('use the same ICU placeholders on both sides', () => {
    // A count interpolated in French but hardcoded in English renders a stray
    // "{count}" to the reader. Compare the variable sets, not the text.
    const names = (value: string) => [...value.matchAll(/\{(\w+)[,}]/g)].map((m) => m[1]).sort();

    const mismatched: string[] = [];
    for (const [code, flat] of others) {
      for (const [key, frValue] of reference) {
        const value = flat.get(key);
        if (value === undefined) continue;
        if (JSON.stringify(names(frValue)) !== JSON.stringify(names(value))) {
          mismatched.push(`${code}:${key}`);
        }
      }
    }
    expect(mismatched).toEqual([]);
  });

  it('never use a straight apostrophe inside a word', () => {
    // ICU MessageFormat treats ' as its escape character: "l'abonnement" makes
    // everything after it literal, so a following {placeholder} silently stops
    // interpolating. English text is full of apostrophes, which makes this a
    // live hazard rather than a theoretical one. U+2019 is the right character
    // typographically anyway.
    const offenders: string[] = [];
    for (const [code, flat] of Object.entries(catalogues)) {
      for (const [key, value] of flat) {
        if (/[\p{L}]'[\p{L}]/u.test(value)) offenders.push(`${code}:${key}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});
