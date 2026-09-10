'use client';

import { createBrowserClient } from '@supabase/ssr';
import { publicEnv } from '@/lib/env';
import type { Database } from './database.types';

/**
 * Browser client. Carries the anon key only — every read it makes is subject
 * to RLS, which is the whole point. If a query returns data a non-member
 * should not see, the bug is in the policy, not here.
 */
export function createClient() {
  const env = publicEnv();
  return createBrowserClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}
