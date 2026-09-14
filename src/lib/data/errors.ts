import 'server-only';
import { createClient } from '@/lib/supabase/server';
import { supabaseConfigured } from '@/lib/env';

/**
 * The crash log, read back.
 *
 * Through the ordinary anon client, so the `is_admin()` policy on
 * `app_errors` decides. An instructor calling this gets an empty list rather
 * than a refusal, which is the correct shape: the rows are not theirs to see
 * and their absence is not an error.
 *
 * Nothing here is cached. A stale crash log is worse than none — the whole
 * value is that a code read off a screen thirty seconds ago resolves now.
 */

export interface AppError {
  id: string;
  at: string;
  route: string;
  digest: string;
  name: string;
  message: string;
  stackHead: string;
}

const SELECT = 'id, at, route, digest, name, message, stack_head';

interface Row {
  id: string;
  at: string;
  route: string;
  digest: string;
  name: string;
  message: string;
  stack_head: string;
}

function toError(row: Row): AppError {
  return {
    id: row.id,
    at: row.at,
    route: row.route,
    digest: row.digest,
    name: row.name,
    message: row.message,
    stackHead: row.stack_head,
  };
}

/** The newest few, whatever instance they came from. */
export async function recentAppErrors(limit = 15): Promise<AppError[]> {
  if (!supabaseConfigured) return [];

  const supabase = await createClient();
  const { data } = await supabase
    .from('app_errors')
    .select(SELECT)
    .order('at', { ascending: false })
    .limit(limit);

  return ((data ?? []) as Row[]).map(toError);
}

/**
 * Every row matching one digest.
 *
 * A digest is stable for a given build and fault, so the same code can appear
 * several times — which is itself worth seeing, because a fault that recurs on
 * one route and never on another is half-diagnosed already.
 *
 * The digest is trimmed rather than validated into a shape: Next has changed
 * what a digest looks like before, and a lookup that refuses an unfamiliar
 * format would fail exactly when a new format arrives.
 */
export async function findErrorByDigest(digest: string): Promise<AppError[]> {
  const needle = digest.trim().slice(0, 100);
  if (!supabaseConfigured || needle === '') return [];

  const supabase = await createClient();
  const { data } = await supabase
    .from('app_errors')
    .select(SELECT)
    .eq('digest', needle)
    .order('at', { ascending: false })
    .limit(10);

  return ((data ?? []) as Row[]).map(toError);
}
