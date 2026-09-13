/**
 * Server-side error capture.
 *
 * `onRequestError` is the one place Next hands over the real error — message,
 * stack and the route that threw — before it is reduced to a digest for the
 * browser. Everything that reaches here is written to the log in a shape that
 * can be searched for, and kept briefly in memory so an admin without access
 * to the platform's logs can still read it.
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
}
