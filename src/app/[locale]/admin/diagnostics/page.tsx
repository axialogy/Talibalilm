import { getTranslations, setRequestLocale } from 'next-intl/server';
import { AlertTriangle, CheckCircle2, CircleSlash, XCircle } from 'lucide-react';
import { BackLink } from '@/components/admin/BackLink';
import { runDiagnostics, type CheckState } from '@/lib/data/diagnostics';
import { requireAdmin } from '@/lib/auth/guards';

export const dynamic = 'force-dynamic';

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
export default async function DiagnosticsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  await requireAdmin();
  const t = await getTranslations('admin');
  const checks = await runDiagnostics();

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
        </section>
      ))}
    </div>
  );
}
