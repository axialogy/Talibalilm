/**
 * Server-side error capture.
 *
 * `onRequestError` is the one place Next hands over the real error — message,
 * stack and the route that threw — before it is reduced to a digest for the
 * browser. Everything that reaches here goes three places, on purpose:
 *
 *   1. The platform log, in a line that can be searched for.
 *   2. This instance's memory, so the Diagnostic page can show it instantly.
 *   3. The database, so it is still there when the office looks — which is the
 *      one that actually matters. A serverless deployment runs many instances,
 *      and for weeks the record lived only in the memory of whichever one
 *      happened to crash. The office would open Diagnostic, land on a different
 *      instance, and read "aucune erreur enregistrée" about an error the server
 *      had captured in full. Evidence that cannot be fetched is evidence we did
 *      not keep.
 */
export async function onRequestError(
  error: unknown,
  request: { path?: string },
  context: { routePath?: string },
): Promise<void> {
  const { recordError, isControlFlow } = await import('@/lib/observability/recent-errors');
  const route = context.routePath || request.path || 'unknown';

  recordError(route, error);
  if (isControlFlow(error)) return;

  const err = error instanceof Error ? error : new Error(String(error));

  // One line, prefixed, so it can be found in a log full of request noise.
  console.error(`[REQUEST ERROR] ${route} :: ${err.name}: ${err.message}`);
  if (err.stack) console.error(err.stack);

  await persist(route, err, error);
}

/**
 * Write the error where any instance can read it back.
 *
 * Wrapped whole in its own try/catch, and awaited rather than floated: this
 * runs on a path that is ALREADY failing, and an error handler that throws its
 * own error replaces the fault with a worse one. If the write fails — no
 * database, no migration, no network — the log line above has already gone out
 * and nothing here makes that worse.
 *
 * It goes through the ordinary anon client and a write-only `SECURITY DEFINER`
 * function. No service-role client: this is not a path that has authenticated
 * anybody, and a crash handler is the last place that should hold a key which
 * bypasses every policy.
 */
async function persist(route: string, err: Error, original: unknown): Promise<void> {
  try {
    const { supabaseConfigured } = await import('@/lib/env');
    if (!supabaseConfigured) return;

    // `createPublicClient`, not `createClient`: the cookie-bound one reads
    // `cookies()`, and an error handler does not reliably run inside a request
    // scope — it would throw here and record nothing. Same anon key, same
    // policies, and the function it calls writes without reading.
    const { createPublicClient } = await import('@/lib/supabase/server');
    const supabase = createPublicClient();

    const digest = (original as { digest?: unknown } | null)?.digest;

    await supabase.rpc('record_app_error', {
      p_route: route,
      p_digest: typeof digest === 'string' ? digest : '',
      p_name: err.name,
      p_message: err.message,
      p_stack_head: (err.stack ?? '')
        .split('\n')
        .slice(1, 6)
        .map((line) => line.trim())
        .join('\n'),
    });
  } catch {
    // Deliberately silent. Reporting a failure to report a failure is a loop,
    // and the console line above is already out.
  }
}
