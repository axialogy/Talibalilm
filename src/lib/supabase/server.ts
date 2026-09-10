import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { publicEnv, serverEnv } from '@/lib/env';
import type { Database } from './database.types';

/**
 * Server client, bound to the request's cookies. Use this in Server
 * Components, Route Handlers and Server Actions.
 *
 * Still the anon key: RLS applies. Server-side rendering is not a licence to
 * bypass the policies — it is where they are enforced for the initial paint.
 */
export async function createClient() {
  const cookieStore = await cookies();
  const env = publicEnv();

  return createServerClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Server Components cannot set cookies. The middleware refreshes
            // the session on every request, so losing the write here is safe.
          }
        },
      },
    },
  );
}

/**
 * Service-role client. Bypasses RLS entirely.
 *
 * Only for work no user may perform on their own behalf: granting membership
 * from a verified Stripe webhook, the nightly expiry job, minting a LiveKit
 * token after an authorisation check has already passed. Never construct this
 * in response to unvalidated user input, and never in a Client Component —
 * the key would end up in the browser bundle.
 */
export function createAdminClient() {
  const env = publicEnv();
  const { SUPABASE_SERVICE_ROLE_KEY } = serverEnv();

  return createServerClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    cookies: {
      getAll() {
        return [];
      },
      setAll() {
        // A service-role client is never tied to a user session.
      },
    },
  });
}
