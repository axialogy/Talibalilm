import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * The SQL that gets pasted into the Supabase dashboard must be pure SQL.
 *
 * The editor is not psql. It rejects backslash meta-commands outright, and it
 * runs the whole paste inside one transaction of its own — so a single
 * unrecognised line rolls back everything and the result looks identical to
 * having done nothing at all. That is exactly what happened: a trailing
 * `\echo 'Schema applied.'` silently cost a 1689-line schema.
 */
const PSQL_ONLY = /^\s*\\(echo|set|i|ir|copy|c|d|timing|pset|gexec)\b/m;

function bundle(): string {
  return execFileSync('./supabase/bundle.sh', { encoding: 'utf8' });
}

describe('SQL meant for the Supabase editor', () => {
  it('emits no psql meta-commands in the schema bundle', () => {
    const match = PSQL_ONLY.exec(bundle());
    expect(match?.[0] ?? null).toBeNull();
  });

  it('emits no psql meta-commands in the seed', () => {
    const match = PSQL_ONLY.exec(readFileSync('supabase/seed.sql', 'utf8'));
    expect(match?.[0] ?? null).toBeNull();
  });

  it('opens no transaction of its own', () => {
    // The editor already wraps the paste. A nested BEGIN/COMMIT is a second
    // way for the whole thing to be thrown away.
    for (const sql of [bundle(), readFileSync('supabase/seed.sql', 'utf8')]) {
      expect(/^\s*(begin|commit|rollback)\s*;/im.exec(sql)?.[0] ?? null).toBeNull();
    }
  });

  it('carries every migration, in filename order', () => {
    const text = bundle();
    const names = [...text.matchAll(/^-- (\d{14}_[a-z_]+\.sql)$/gm)].map((m) => m[1]);
    expect(names.length).toBeGreaterThanOrEqual(5);
    expect(names).toEqual([...names].sort());
  });
});
