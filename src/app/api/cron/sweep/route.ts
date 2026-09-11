import { NextResponse, type NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { supabaseConfigured } from '@/lib/env';

/**
 * The housekeeping the shop needs to stay honest.
 *
 * Two jobs, deliberately in one endpoint because they must both run and
 * neither is worth its own schedule:
 *
 *   * Cancel checkouts nobody came back to, and give back the coupon and pack
 *     redemption they were holding. A student who closes the tab on PayPal's
 *     page never reaches our cancel route, so without this their single-use
 *     code is gone for good.
 *   * Mark expired entitlements expired. Purely cosmetic —
 *     `has_course_access` already ignores them on the clock — but it keeps the
 *     admin listings truthful and the partial indexes small.
 *
 * Protected by a shared secret rather than a session: Vercel Cron calls this
 * with no user. Without `CRON_SECRET` set it refuses outright, because an open
 * endpoint that cancels orders is worse than a job that does not run.
 */
export const dynamic = 'force-dynamic';

function authorised(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;

  // Vercel Cron sends `Authorization: Bearer <CRON_SECRET>`.
  const header = request.headers.get('authorization') ?? '';
  const offered = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (offered.length !== secret.length) return false;

  // Constant-time. A length check leaks nothing useful; a character-by-
  // character early return would.
  let diff = 0;
  for (let i = 0; i < secret.length; i += 1) {
    diff |= offered.charCodeAt(i) ^ secret.charCodeAt(i);
  }
  return diff === 0;
}

export async function GET(request: NextRequest) {
  if (!authorised(request)) {
    return NextResponse.json({ error: 'unauthorised' }, { status: 401 });
  }
  if (!supabaseConfigured) {
    return NextResponse.json({ error: 'not_configured' }, { status: 503 });
  }

  const supabase = createAdminClient();

  const { data: swept, error: sweepError } = await supabase.rpc('expire_pending_orders', {
    older_than: '30 minutes',
  });
  const { data: expired, error: expiryError } = await supabase.rpc('expire_entitlements');

  const failed = sweepError ?? expiryError;
  if (failed) {
    console.error('[cron] sweep failed:', failed.message);
    return NextResponse.json({ error: 'sweep_failed' }, { status: 500 });
  }

  const result = { ordersCancelled: swept ?? 0, entitlementsExpired: expired ?? 0 };
  if (result.ordersCancelled > 0 || result.entitlementsExpired > 0) {
    console.info('[cron] sweep:', result);
  }
  return NextResponse.json(result);
}
