import 'server-only';

/**
 * The single place an unexpected server error is reported.
 *
 * Today it writes a structured line to the log, which on Vercel is searchable
 * and alertable. It is a seam, not a stub: when the school connects Sentry
 * (audit A3), the forward goes here and every existing call site starts
 * paging without change. Wiring `console.error` everywhere instead would mean
 * hunting them all down later.
 *
 * `context` is a short stable key ('catalogue.list', 'paypal.capture') so the
 * same failure is greppable across occurrences; `detail` carries the specifics.
 */
export function reportError(context: string, error: unknown, detail?: Record<string, unknown>): void {
  const message = error instanceof Error ? error.message : String(error);
  console.error(
    `[error] ${context}: ${message}`,
    detail ? JSON.stringify(detail) : '',
  );

  // Sentry (or equivalent) forwards from here once SENTRY_DSN is set. Left as a
  // seam deliberately — the dependency and its config belong to the school's
  // launch checklist, not to this commit.
}
