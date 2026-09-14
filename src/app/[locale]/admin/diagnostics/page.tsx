import { getTranslations, setRequestLocale } from 'next-intl/server';
import { AlertTriangle, CheckCircle2, CircleSlash, XCircle } from 'lucide-react';
import { BackLink } from '@/components/admin/BackLink';
import { R2BrowserCheck } from '@/components/admin/R2BrowserCheck';
import { SmtpHostTest } from '@/components/admin/SmtpHostTest';
import { runDiagnostics, type CheckState } from '@/lib/data/diagnostics';
import { recentErrors } from '@/lib/observability/recent-errors';
import { findErrorByDigest, recentAppErrors } from '@/lib/data/errors';
import { requireAdmin } from '@/lib/auth/guards';

export const dynamic = 'force-dynamic';

/**
 * Room to finish.
 *
 * This page makes more outbound calls than any other request the app serves —
 * every table, every function, three HTTP probes and a mail-server handshake.
 * Vercel's default allowance is ten seconds, and a page that is killed halfway
 * reports its own truncation as a fault in the thing it was measuring, which is
 * worse than being slow. The probes are individually capped at four seconds and
 * run five at a time, so this is headroom rather than a licence to hang.
 */
export const maxDuration = 60;

/**
 * What this deployment can and cannot see.
 *
 * Several faults have cost a round each, all the same shape: a table or a
 * function missing because a migration was never run against this project, or
 * a variable added to Vercel after the deployment that is serving. The app
 * degrades quietly in those cases — deliberately, because a missing receipt
 * must never lose a sale — and quiet degradation is what makes the cause hard
 * to find from outside.
 *
 * This page asks every question at once and prints the database's own words.
 * Admin only, read-only, and safe to open in front of anyone: it names tables,
 * functions and variable names, never a value.
 */
export default async function DiagnosticsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ digest?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  await requireAdmin();
  const t = await getTranslations('admin');
  const checks = await runDiagnostics();

  // A code off an error page, looked up. This is the whole reason the durable
  // table exists: the office reads a number on a broken screen and gets the
  // message, the route and the first stack frames back.
  const { digest } = await searchParams;
  const lookup = digest ? await findErrorByDigest(digest) : [];

  // Durable rows first, this instance's memory second. The in-memory list is
  // instant and covers the seconds before a write lands; the table is the one
  // that survives the request ending up on another instance, which is what
  // made the old list read empty about errors the server had captured in full.
  const stored = await recentAppErrors();
  const errors = recentErrors();
  const timeFmt = new Intl.DateTimeFormat(locale, { dateStyle: 'short', timeStyle: 'medium' });

  const groups = [...new Set(checks.map((c) => c.group))];
  const bad = checks.filter((c) => c.state === 'missing' || c.state === 'error');

  const icon = (state: CheckState) => {
    if (state === 'ok')
      return <CheckCircle2 className="size-4 shrink-0 text-brand-500" aria-hidden="true" />;
    if (state === 'missing')
      return <XCircle className="size-4 shrink-0 text-red-600" aria-hidden="true" />;
    if (state === 'error')
      return <AlertTriangle className="size-4 shrink-0 text-gold-600" aria-hidden="true" />;
    return <CircleSlash className="size-4 shrink-0 text-ink-muted/50" aria-hidden="true" />;
  };

  return (
    <div className="max-w-3xl">
      <BackLink href="/admin" label={t('navOverview')} />
      <h1 className="font-display text-2xl font-semibold text-ink">{t('diagTitle')}</h1>
      <p className="mt-2 max-w-2xl text-[13px] leading-relaxed text-ink-muted">{t('diagLead')}</p>

      {bad.length > 0 ? (
        <div className="mt-6 rounded-[var(--radius-card)] border border-red-200 bg-red-50/50 p-5">
          <p className="text-[13px] font-medium text-red-700">
            {t('diagProblems', { count: bad.length })}
          </p>
          <ul className="mt-2 list-disc space-y-1 ps-5 text-[12px] text-red-700">
            {bad.map((c) => (
              <li key={`${c.group}-${c.name}`}>
                <span className="font-mono">{c.name}</span> — {c.detail}
              </li>
            ))}
          </ul>
          <p className="mt-3 text-[12px] leading-relaxed text-ink-muted">{t('diagHint')}</p>
        </div>
      ) : (
        <p className="mt-6 rounded-[var(--radius-card)] border border-brand-200 bg-brand-50/50 p-5 text-[13px] text-brand-700">
          {t('diagAllGood')}
        </p>
      )}

      {/*
        The page a digest is for.

        Next strips an error's message from the browser in production and
        leaves only a hash — correct, since a stack can name internals, and
        useless when nobody can open the platform's logs. So the server keeps
        its own record, and this is where it is read back.

        Two lists, because they fail differently. The DURABLE one is in
        Postgres and is what anybody sees from any instance. The INSTANCE one
        is this container's memory: instant, and gone the moment the container
        is recycled. For weeks there was only the second, which is why the
        office kept opening this page and reading "aucune erreur" about faults
        the server had captured in full.
      */}
      <section className="mt-8">
        <h2 className="font-display text-[15px] font-semibold text-ink">{t('diagErrors')}</h2>
        <p className="mt-1.5 text-[12px] leading-relaxed text-ink-muted">{t('diagErrorsLead')}</p>

        {/* Paste the code from the error page. A GET form with no action so it
            submits to this same URL and stays linkable. */}
        <form className="mt-3 flex flex-wrap gap-2">
          <input
            type="search"
            name="digest"
            defaultValue={digest ?? ''}
            placeholder={t('diagDigestPlaceholder')}
            aria-label={t('diagDigestTitle')}
            className="min-w-0 flex-1 rounded-[var(--radius-input)] border border-line bg-white px-3 py-2 font-mono text-[12px] text-ink"
          />
          <button
            type="submit"
            className="rounded-full bg-brand-500 px-4 py-2 text-[13px] font-medium text-white transition-colors hover:bg-brand-600"
          >
            {t('diagDigestSearch')}
          </button>
        </form>

        {digest &&
          (lookup.length === 0 ? (
            <p className="mt-3 rounded-[var(--radius-card)] border border-dashed border-line bg-surface/50 p-4 text-[12px] leading-relaxed text-ink-muted">
              {t('diagDigestNone')}
            </p>
          ) : (
            <ul className="mt-3 divide-y divide-line rounded-[var(--radius-card)] border border-brand-200 bg-brand-50/30">
              {lookup.map((e) => (
                <li key={e.id} className="p-3">
                  <div className="flex flex-wrap items-baseline gap-2">
                    <span className="font-mono text-[12px] text-ink">{e.route}</span>
                    <span className="text-[11px] text-ink-muted">
                      {timeFmt.format(new Date(e.at))}
                    </span>
                  </div>
                  <p className="mt-1 text-[12px] break-words text-red-700">
                    {e.name}: {e.message}
                  </p>
                  {e.stackHead && (
                    <pre className="mt-2 overflow-x-auto rounded-[var(--radius-input)] border border-line bg-white p-3 font-mono text-[11px] leading-relaxed whitespace-pre-wrap text-ink-muted">
                      {e.stackHead}
                    </pre>
                  )}
                </li>
              ))}
            </ul>
          ))}

        <h3 className="mt-6 text-[13px] font-medium text-ink">{t('diagErrorsStored')}</h3>
        {stored.length === 0 ? (
          <p className="mt-2 rounded-[var(--radius-card)] border border-dashed border-line bg-surface/50 p-4 text-center text-[12px] text-ink-muted">
            {t('diagErrorsEmpty')}
          </p>
        ) : (
          <ul className="mt-2 divide-y divide-line rounded-[var(--radius-card)] border border-line bg-white">
            {stored.map((e) => (
              <li key={e.id} className="p-3">
                <div className="flex flex-wrap items-baseline gap-2">
                  <span className="font-mono text-[12px] text-ink">{e.route}</span>
                  <span className="text-[11px] text-ink-muted">
                    {timeFmt.format(new Date(e.at))}
                  </span>
                  {e.digest && (
                    <span className="rounded bg-surface px-1.5 py-0.5 font-mono text-[11px] text-ink-muted">
                      {e.digest}
                    </span>
                  )}
                </div>
                <p className="mt-1 text-[12px] break-words text-red-700">
                  {e.name}: {e.message}
                </p>
                {e.stackHead && (
                  <pre className="mt-1 overflow-x-auto font-mono text-[11px] break-words whitespace-pre-wrap text-ink-muted">
                    {e.stackHead}
                  </pre>
                )}
              </li>
            ))}
          </ul>
        )}

        <h3 className="mt-6 text-[13px] font-medium text-ink">{t('diagErrorsInstance')}</h3>
        {errors.length === 0 ? (
          <p className="mt-2 rounded-[var(--radius-card)] border border-dashed border-line bg-surface/50 p-4 text-center text-[12px] text-ink-muted">
            {t('diagErrorsEmpty')}
          </p>
        ) : (
          <ul className="mt-2 divide-y divide-line rounded-[var(--radius-card)] border border-line bg-white">
            {errors.map((e) => (
              <li key={`${e.at}-${e.route}`} className="p-3">
                <div className="flex flex-wrap items-baseline gap-2">
                  <span className="font-mono text-[12px] text-ink">{e.route}</span>
                  <span className="text-[11px] text-ink-muted">
                    {timeFmt.format(new Date(e.at))}
                  </span>
                  {e.digest && (
                    <span className="rounded bg-surface px-1.5 py-0.5 font-mono text-[11px] text-ink-muted">
                      {e.digest}
                    </span>
                  )}
                </div>
                <p className="mt-1 text-[12px] break-words text-red-700">{e.message}</p>
                {e.where && (
                  <p className="mt-0.5 font-mono text-[11px] break-words text-ink-muted">
                    {e.where}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {groups.map((group) => (
        <section key={group} className="mt-8">
          <h2 className="font-display text-[15px] font-semibold text-ink">{group}</h2>
          <ul className="mt-3 divide-y divide-line rounded-[var(--radius-card)] border border-line bg-white">
            {checks
              .filter((c) => c.group === group)
              .map((c) => (
                <li key={`${c.group}-${c.name}`} className="flex items-start gap-3 p-3">
                  {icon(c.state)}
                  <span className="w-52 shrink-0 font-mono text-[12px] text-ink">{c.name}</span>
                  <span className="min-w-0 flex-1 text-[12px] break-words text-ink-muted">
                    {c.detail}
                  </span>
                </li>
              ))}
          </ul>

          {/*
            The two questions this page cannot answer by itself, each placed
            directly under the rows it settles rather than in a corner nobody
            scrolls to. Both exist because a probe that could not complete was
            being printed as a fault it never observed — the cure for which is
            not a better guess but asking from somewhere that can answer: the
            browser for CORS, and every plausible host for the mail server.
          */}
          {group === 'Configuration' && <R2BrowserCheck />}
          {group === 'Latence' && <SmtpHostTest />}
        </section>
      ))}
    </div>
  );
}
