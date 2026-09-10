/**
 * In-process rate limiter for the auth endpoints.
 *
 * Deliberately small: it holds counters in the module scope of one serverless
 * instance, so it throttles a single attacker hitting one warm instance and
 * nothing more. It is a speed bump, not a control.
 *
 * Before launch this MUST be replaced by something shared across instances —
 * Upstash Redis or Supabase-side counters. Until then, Supabase Auth's own
 * per-project limits are the real backstop, and the spec's §8 requirement is
 * only partly met. Tracked in the Phase 1 report.
 */
interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

/** Trim expired buckets so a long-lived instance does not grow unbounded. */
function sweep(now: number) {
  if (buckets.size < 500) return;
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}

export function rateLimit(
  key: string,
  { limit, windowMs }: { limit: number; windowMs: number },
): { ok: boolean; retryAfterSeconds: number } {
  const now = Date.now();
  sweep(now);

  const existing = buckets.get(key);
  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, retryAfterSeconds: 0 };
  }

  existing.count += 1;
  if (existing.count > limit) {
    return { ok: false, retryAfterSeconds: Math.ceil((existing.resetAt - now) / 1000) };
  }
  return { ok: true, retryAfterSeconds: 0 };
}

/** Best-effort client address. Spoofable, which is another reason this is a speed bump. */
export function clientKey(headers: Headers, scope: string): string {
  const forwarded = headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  return `${scope}:${forwarded ?? headers.get('x-real-ip') ?? 'unknown'}`;
}
