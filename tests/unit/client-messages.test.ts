import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * The client message allow-list is a performance decision: only namespaces a
 * Client Component actually renders get serialised into every page's payload.
 *
 * The failure mode it introduces is a runtime MISSING_MESSAGE — the page still
 * renders, but a label silently becomes its own key. That is exactly the kind
 * of break a build should catch, so this walks the source and checks the list
 * against reality.
 */
function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) return walk(path);
    return path.endsWith('.tsx') || path.endsWith('.ts') ? [path] : [];
  });
}

const sources = walk('src').map((path) => ({ path, code: readFileSync(path, 'utf8') }));

/** Namespaces requested from inside a file marked `'use client'`. */
function clientNamespaces(onlyUnder?: string): Set<string> {
  const found = new Set<string>();
  for (const { path, code } of sources) {
    if (!code.includes("'use client'")) continue;
    if (onlyUnder && !path.includes(onlyUnder)) continue;
    if (!onlyUnder && path.includes('/admin/')) continue;
    for (const match of code.matchAll(/useTranslations\('([a-zA-Z]+)/g)) {
      const namespace = match[1];
      if (namespace) found.add(namespace);
    }
  }
  return found;
}

const allowList = readFileSync('src/i18n/client-messages.ts', 'utf8');

function listedIn(constName: string): string[] {
  const line = new RegExp(`const ${constName} = \\[([^\\]]*)\\]`).exec(allowList);
  return (line?.[1] ?? '').match(/'([a-zA-Z]+)'/g)?.map((s) => s.replaceAll("'", '')) ?? [];
}

describe('client message allow-list', () => {
  it('covers every namespace a non-admin Client Component uses', () => {
    const shipped = new Set(listedIn('CLIENT_NAMESPACES'));
    const missing = [...clientNamespaces()].filter((ns) => !shipped.has(ns));
    expect(missing).toEqual([]);
  });

  it('covers every namespace an admin Client Component uses', () => {
    // ADMIN_NAMESPACES spreads CLIENT_NAMESPACES, so both lists apply.
    const shipped = new Set([...listedIn('CLIENT_NAMESPACES'), ...listedIn('ADMIN_NAMESPACES')]);
    const missing = [...clientNamespaces('/admin/')].filter((ns) => !shipped.has(ns));
    expect(missing).toEqual([]);
  });

  it('ships nothing a Client Component never asks for', () => {
    // Keeps the list honest in the other direction: a namespace left behind
    // after a refactor is dead weight in every page payload.
    const used = new Set([...clientNamespaces(), ...clientNamespaces('/admin/')]);
    const shipped = [...listedIn('CLIENT_NAMESPACES'), ...listedIn('ADMIN_NAMESPACES')];
    const unused = [...new Set(shipped)].filter((ns) => !used.has(ns));
    expect(unused).toEqual([]);
  });
});
