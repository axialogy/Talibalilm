'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { CheckCircle2, CircleSlash, Server, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ActionError } from '@/components/admin/ActionError';
import { testSmtpHosts } from '@/app/actions/diagnostics';
import type { SmtpCandidate } from '@/lib/email/send';
import type { AdminState } from '@/app/actions/admin';

const IDLE: AdminState = { ok: false };

/**
 * Which mail server accepts our credentials?
 *
 * `SMTP_HOST` names a host with no DNS record, so every send dies at the
 * resolver with `getaddrinfo EBUSY`. No amount of code fixes a name that is not
 * there — and no amount of guessing at the right one has helped either.
 *
 * So the server stops guessing and tries: the configured host, the domain's own
 * MX records, the conventional names, each checked against DNS first. One line
 * per candidate saying what it did. The line that says it works is the value to
 * paste into Vercel — and into Supabase's SMTP settings, which point at the
 * same dead name and fail the same way.
 *
 * Nothing is sent. The probe authenticates and hangs up.
 */
export function SmtpHostTest() {
  const t = useTranslations('admin');
  const [state, setState] = useState<AdminState>(IDLE);
  const [rows, setRows] = useState<SmtpCandidate[] | null>(null);
  const [busy, setBusy] = useState(false);

  const run = async () => {
    setBusy(true);
    setState(IDLE);
    setRows(null);
    try {
      const result = await testSmtpHosts();
      setState(result);
      setRows(result.results ?? null);
    } finally {
      setBusy(false);
    }
  };

  const winner = rows?.find((r) => r.outcome === 'works');

  return (
    <div className="mt-3 rounded-[var(--radius-card)] border border-line bg-white p-4">
      <p className="text-[13px] font-medium text-ink">{t('diagSmtpTest')}</p>
      <p className="mt-1 text-[12px] leading-relaxed text-ink-muted">{t('diagSmtpTestLead')}</p>

      <Button
        type="button"
        size="sm"
        variant="outline"
        className="mt-3"
        disabled={busy}
        onClick={() => void run()}
      >
        <Server className="size-3.5" aria-hidden="true" />
        {busy ? t('diagSmtpTesting') : t('diagSmtpTest')}
      </Button>

      <ActionError state={state} />

      {rows && rows.length > 0 && (
        <>
          <ul className="mt-3 divide-y divide-line rounded-[var(--radius-input)] border border-line">
            {rows.map((row) => (
              <li key={`${row.host}:${row.port}`} className="flex items-start gap-3 p-3">
                {row.outcome === 'works' ? (
                  <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-brand-500" aria-hidden="true" />
                ) : row.outcome === 'dns' ? (
                  <CircleSlash className="mt-0.5 size-4 shrink-0 text-ink-muted/50" aria-hidden="true" />
                ) : (
                  <XCircle className="mt-0.5 size-4 shrink-0 text-red-600" aria-hidden="true" />
                )}
                <span className="min-w-0 flex-1">
                  <span className="block font-mono text-[12px] break-all text-ink">
                    {row.host}:{row.port}
                    <span className="ms-2 font-sans text-[11px] text-ink-muted">({row.source})</span>
                  </span>
                  <span className="mt-0.5 block text-[11px] break-words text-ink-muted">
                    {row.ms} ms — {row.detail}
                  </span>
                </span>
              </li>
            ))}
          </ul>

          <p className="mt-3 text-[12px] leading-relaxed text-ink-muted">
            {winner
              ? t('diagSmtpUse', { host: winner.host, port: winner.port })
              : t('diagSmtpNone')}
          </p>
        </>
      )}
    </div>
  );
}
