/**
 * What the database actually said, formatted for an admin screen.
 *
 * Lives here rather than beside the actions that use it for a mundane reason
 * worth writing down: `src/app/actions/*.ts` are `'use server'` modules, and
 * every export from one of those must be an async function — a plain helper
 * exported from one fails the BUILD, not the type check, which is a slower and
 * more confusing way to find out.
 */
export function errorDetail(error: unknown): string | undefined {
  if (!error || typeof error !== 'object') return undefined;
  const e = error as { code?: string; message?: string; details?: string; hint?: string };
  const parts = [
    e.code ? `[${e.code}]` : null,
    e.message ?? null,
    e.details ?? null,
    e.hint ? `hint: ${e.hint}` : null,
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(' — ') : undefined;
}
