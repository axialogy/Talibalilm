import { NextResponse, type NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { supabaseConfigured } from '@/lib/env';
import { deleteObject } from '@/lib/storage/r2';

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
 *   * Delete lesson videos whose retention has run out. This one cannot be a
 *     Postgres job: the row is the cheap half, and the object in R2 — the half
 *     that is actually billed by the gigabyte-month — can only be removed by
 *     code that holds the bucket credentials.
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

  const videosPurged = await purgeExpiredVideos(supabase);

  // Rolled-over rate-limit windows are dead weight once past. Pruning them is
  // pure housekeeping — a failure here must not fail the sweep that matters.
  const { data: pruned, error: pruneError } = await supabase.rpc('prune_rate_limits');
  if (pruneError) console.error('[cron] rate-limit prune failed:', pruneError.message);

  const result = {
    ordersCancelled: swept ?? 0,
    entitlementsExpired: expired ?? 0,
    rateWindowsPruned: pruned ?? 0,
    videosPurged,
  };
  if (
    result.ordersCancelled > 0 ||
    result.entitlementsExpired > 0 ||
    result.rateWindowsPruned > 0 ||
    result.videosPurged > 0
  ) {
    console.info('[cron] sweep:', result);
  }
  return NextResponse.json(result);
}

/**
 * Delete uploaded videos the school asked us to forget.
 *
 * The object goes first and the row second, deliberately. The other order can
 * leave an object no row points at — unreachable, undeletable by any screen,
 * and still billed every month. This order can at worst leave a row pointing at
 * an object that is already gone, which shows the student an honest "video
 * unavailable" and is fixed by pressing Remove.
 *
 * One at a time, and a failure on one does not stop the rest: a single object
 * R2 refuses must not strand every other expired video behind it.
 */
async function purgeExpiredVideos(supabase: ReturnType<typeof createAdminClient>): Promise<number> {
  const { data: due, error } = await supabase
    .from('lesson_content')
    .select('lesson_id, video_id')
    .eq('video_provider', 'r2')
    .not('video_expires_at', 'is', null)
    .lte('video_expires_at', new Date().toISOString())
    .limit(50);

  if (error) {
    console.error('[cron] expired-video lookup failed:', error.message);
    return 0;
  }
  if (!due || due.length === 0) return 0;

  let removed = 0;
  for (const row of due) {
    if (row.video_id) await deleteObject(row.video_id);
    const { error: clearError } = await supabase
      .from('lesson_content')
      .update({
        video_provider: 'none',
        video_id: null,
        video_bytes: 0,
        video_uploaded_at: null,
        video_expires_at: null,
      })
      .eq('lesson_id', row.lesson_id);
    if (clearError) {
      console.error('[cron] clearing video row failed:', clearError.message);
      continue;
    }
    removed += 1;
  }
  return removed;
}
