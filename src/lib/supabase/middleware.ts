import { createServerClient } from '@supabase/ssr';
import type { NextRequest, NextResponse } from 'next/server';
import { publicEnv, supabaseConfigured } from '@/lib/env';
import type { Database } from './database.types';

/**
 * Refresh the auth session on the response the locale middleware already
 * produced.
 *
 * Supabase access tokens are short-lived; without this the user is silently
 * signed out mid-session. It has to run on the *same* response object that
 * gets returned, or the refreshed cookies never reach the browser.
 *
 * Returns the user so the caller can gate routes without a second round trip.
 */
export async function refreshSession(
  request: NextRequest,
  response: NextResponse,
): Promise<{ userId: string | null }> {
  // Before the Supabase project is connected, the marketing site still has to
  // render. Treat "not configured" as "signed out" rather than throwing.
  if (!supabaseConfigured) return { userId: null };

  const env = publicEnv();

  const supabase = createServerClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  // getUser(), not getSession(): getSession() trusts the cookie as-is, while
  // getUser() revalidates the JWT against the auth server. In middleware,
  // which is what protected routes lean on, the difference is the whole
  // security guarantee.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return { userId: user?.id ?? null };
}
