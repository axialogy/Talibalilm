import { describe, expect, it } from 'vitest';
import fr from '../../messages/fr.json';
import ar from '../../messages/ar.json';

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

const frFlat = flatten(fr as Tree);
const arFlat = flatten(ar as Tree);

describe('message catalogues', () => {
  it('define the same keys in both locales', () => {
    const missingInAr = [...frFlat.keys()].filter((k) => !arFlat.has(k));
    const missingInFr = [...arFlat.keys()].filter((k) => !frFlat.has(k));
    expect({ missingInAr, missingInFr }).toEqual({ missingInAr: [], missingInFr: [] });
  });

  it('leave no value empty', () => {
    const blank = [...frFlat, ...arFlat].filter(([, v]) => v.trim() === '').map(([k]) => k);
    expect(blank).toEqual([]);
  });

  it('use the same ICU placeholders on both sides', () => {
    // A count that is interpolated in French but hardcoded in Arabic renders a
    // stray "{count}" to the reader. Compare the variable sets, not the text.
    const names = (value: string) =>
      [...value.matchAll(/\{(\w+)[,}]/g)].map((m) => m[1]).sort();

    const mismatched: string[] = [];
    for (const [key, frValue] of frFlat) {
      const arValue = arFlat.get(key);
      if (arValue === undefined) continue;
      if (JSON.stringify(names(frValue)) !== JSON.stringify(names(arValue))) mismatched.push(key);
    }
    expect(mismatched).toEqual([]);
  });
});
