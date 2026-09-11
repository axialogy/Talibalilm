import { getTranslations, setRequestLocale } from 'next-intl/server';
import { BackLink } from '@/components/admin/BackLink';
import {
  PaymentSettingsForm,
  type PaymentStatus,
} from '@/components/admin/PaymentSettingsForm';
import { requireAdmin } from '@/lib/auth/guards';
import { createClient } from '@/lib/supabase/server';
import { siteUrl } from '@/lib/env';

/**
 * PayPal configuration.
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

  const { data } = await supabase.rpc('payment_settings_status');
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

  return (
    <div className="max-w-2xl">
      <BackLink href="/admin" label={t('navOverview')} />
      <h1 className="font-display text-2xl font-semibold text-ink">{t('paymentsTitle')}</h1>
      <p className="mt-2 text-[13px] leading-relaxed text-ink-muted">{t('paymentsLead')}</p>

      <div className="mt-8">
        <PaymentSettingsForm
          status={status}
          webhookUrl={`${siteUrl()}/api/paypal/webhook`}
          envOverride={envOverride}
        />
      </div>
    </div>
  );
}
