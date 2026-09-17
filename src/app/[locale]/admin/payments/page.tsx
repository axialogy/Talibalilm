import { getTranslations, setRequestLocale } from 'next-intl/server';
import { BackLink } from '@/components/admin/BackLink';
import { Link } from '@/i18n/navigation';
import { Badge } from '@/components/ui/badge';
import { Tabs } from '@/components/ui/tabs';
import { PaymentSettingsForm, type PaymentStatus } from '@/components/admin/PaymentSettingsForm';
import { PinGate } from '@/components/admin/PinGate';
import { requireAdmin } from '@/lib/auth/guards';
import { stepUpState } from '@/lib/security/stepup-server';
import { createClient } from '@/lib/supabase/server';
import { studentPayments, type PaymentStanding } from '@/lib/data/admin';
import { formatAmount } from '@/lib/commerce/quote';
import { siteUrl } from '@/lib/env';

/**
 * Payments — who has paid, then how PayPal is set up.
 *
 * The money comes first because that is what the office opens this screen to
 * see. The configuration is a thing you touch once and then leave alone, so it
 * sits behind the second tab rather than in front of the answer.
 *
 * Admin only, and not merely by convention: `payment_settings` grants nothing
 * to `authenticated`, so this page cannot read the table at all. It calls
 * `payment_settings_status()`, a security-definer function that checks
 * `is_admin()` itself and reports whether a secret exists without ever
 * returning one.
 */
export default async function AdminPaymentsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  await requireAdmin();
  const t = await getTranslations('admin');
  const supabase = await createClient();

  const [{ data }, rows, gate] = await Promise.all([
    supabase.rpc('payment_settings_status'),
    studentPayments(),
    stepUpState(),
  ]);

  const status = (data as unknown as PaymentStatus | null) ?? {
    environment: 'sandbox',
    client_id: '',
    merchant_email: '',
    currency: 'EUR',
    enabled: false,
    has_secret: false,
    has_webhook_id: false,
  };

  // Read here rather than in the client component: the presence of the
  // variables is safe to report, their values are not.
  const envOverride = Boolean(process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_CLIENT_SECRET);
  const dateFmt = new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });

  const badge: Record<PaymentStanding, 'success' | 'warn' | 'muted'> = {
    paid: 'success',
    partial: 'warn',
    pending: 'muted',
  };
  const standingLabel: Record<PaymentStanding, string> = {
    paid: t('standingPaid'),
    partial: t('standingPartial'),
    pending: t('standingPending'),
  };

  return (
    <div>
      <BackLink href="/admin" label={t('navOverview')} />
      <h1 className="font-display text-2xl font-semibold text-ink">{t('paymentsTitle')}</h1>
      <p className="mt-2 max-w-2xl text-[13px] leading-relaxed text-ink-muted">
        {t('paymentsLead')}
      </p>

      <div className="mt-8">
        <Tabs
          tabs={[
            {
              key: 'history',
              label: t('paymentsTabHistory'),
              content: (
                <div>
                  <h2 className="font-display text-lg font-semibold text-ink">
                    {t('paymentsByStudent')}
                  </h2>
                  <p className="mt-1.5 text-[13px] text-ink-muted">{t('paymentsByStudentLead')}</p>

                  {rows.length === 0 ? (
                    <p className="mt-6 rounded-[var(--radius-card)] border border-dashed border-line bg-surface/50 p-8 text-center text-sm text-ink-muted">
                      {t('paymentsNobody')}
                    </p>
                  ) : (
                    <div className="mt-5 overflow-x-auto rounded-[var(--radius-card)] border border-line">
                      <table className="w-full min-w-[760px] border-collapse text-[13px]">
                        <thead>
                          <tr className="bg-surface/60 text-left text-[11px] tracking-wide text-ink-muted uppercase">
                            <th className="p-3 font-medium">{t('colName')}</th>
                            <th className="p-3 font-medium">{t('colStanding')}</th>
                            <th className="p-3 font-medium">{t('colItems')}</th>
                            <th className="p-3 text-right font-medium">{t('colPaid')}</th>
                            <th className="p-3 text-right font-medium">{t('colOutstanding')}</th>
                            <th className="p-3 font-medium">{t('colLastPayment')}</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-line">
                          {rows.map((row) => (
                            <tr key={row.userId} className="transition-colors hover:bg-brand-50/40">
                              <td className="p-3">
                                <Link
                                  href={`/admin/students/${row.userId}`}
                                  className="font-medium text-ink hover:text-brand-600"
                                >
                                  {row.fullName || '—'}
                                </Link>
                              </td>
                              <td className="p-3">
                                <Badge variant={badge[row.standing]}>
                                  {standingLabel[row.standing]}
                                </Badge>
                              </td>
                              <td className="p-3 text-ink-muted">
                                {row.items.length > 0 ? row.items.join(' · ') : '—'}
                              </td>
                              <td className="p-3 text-right font-medium text-ink tabular-nums">
                                {formatAmount(row.paidCents, locale, row.currency)}
                              </td>
                              <td className="p-3 text-right tabular-nums">
                                {row.outstandingCents > 0 ? (
                                  <span className="text-amber-700">
                                    {formatAmount(row.outstandingCents, locale, row.currency)}
                                  </span>
                                ) : (
                                  <span className="text-ink-muted">—</span>
                                )}
                              </td>
                              <td className="p-3 whitespace-nowrap text-ink-muted">
                                {row.lastPaidAt ? dateFmt.format(new Date(row.lastPaidAt)) : '—'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  <p className="mt-5">
                    <Link
                      href="/admin/orders"
                      className="text-[13px] text-brand-600 hover:text-brand-700"
                    >
                      {t('paymentsAllOrders')} →
                    </Link>
                  </p>
                </div>
              ),
            },
            {
              key: 'config',
              label: t('paymentsTabConfig'),
              content: (
                <div className="max-w-2xl">
                  {gate.unlocked ? (
                    <PaymentSettingsForm
                      status={status}
                      webhookUrl={`${siteUrl()}/api/paypal/webhook`}
                      envOverride={envOverride}
                    />
                  ) : (
                    <PinGate pinSet={gate.pinSet} configured={gate.configured} />
                  )}
                </div>
              ),
            },
          ]}
        />
      </div>
    </div>
  );
}
