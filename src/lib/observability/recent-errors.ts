import 'server-only';

/**
 * The last few server errors, kept in memory so an admin can read them.
 *
 * Next strips an error's message from the browser in production — correctly,
 * since a stack can name internals — and leaves only a digest. That is fine
 * when someone can open the platform's logs, and useless when they cannot: it
 * has now cost several rounds of guessing at a fault the server knew the whole
 * time.
 *
 * So the server keeps its own short record. Deliberately small and deliberately
 * in memory: it is a debugging aid, not an audit trail, and it must not become
 * a table that grows or a write on a path that is already failing.
 *
 * Honest about its limits. A serverless deployment runs many instances, and
 * this one only holds what the instance answering YOUR request happened to see.
 * The page that shows it says so rather than implying the list is complete.
 */
export interface RecordedError {
  at: number;
  route: string;
  message: string;
  /** The first frames only. Enough to name a file, not enough to be a dump. */
  where: string;
}

const LIMIT = 15;
const recent: RecordedError[] = [];

/**
 * Next tags its control-flow exceptions with a `digest` the type does not
 * declare. Read it through a widened type rather than casting the error away.
 */
export function isControlFlow(error: unknown): boolean {
  const digest = (error as { digest?: unknown } | null)?.digest;
  return typeof digest === 'string' && /^NEXT_(REDIRECT|NOT_FOUND)/.test(digest);
}

export function recordError(route: string, error: unknown): void {
  // Redirects and not-founds travel as exceptions in the App Router. They are
  // control flow, not faults, and recording them would bury the real ones.
  if (isControlFlow(error)) return;

  const err = error instanceof Error ? error : new Error(String(error));

  recent.unshift({
    at: Date.now(),
    route,
    message: `${err.name}: ${err.message}`,
    where: (err.stack ?? '')
      .split('\n')
      .slice(1, 4)
      .map((line) => line.trim())
      .join(' · '),
  });
  recent.length = Math.min(recent.length, LIMIT);
}

export function recentErrors(): RecordedError[] {
  return [...recent];
}
