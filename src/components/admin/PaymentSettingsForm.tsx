'use client';

import { useActionState } from 'react';
import { useTranslations } from 'next-intl';
import { KeyRound, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { savePaymentSettings } from '@/app/actions/catalog';
import type { AdminState } from '@/app/actions/admin';

const EMPTY: AdminState = { ok: true };

export interface PaymentStatus {
  environment: 'sandbox' | 'live';
  client_id: string;
  merchant_email: string;
  currency: string;
  enabled: boolean;
  has_secret: boolean;
  has_webhook_id: boolean;
}

/**
 * PayPal credentials.
 *
 * The secret and webhook id fields are always blank, including when one is
 * stored — the server never sends them here, because a page that could show
 * the secret is a page that could leak it. Leaving a field empty keeps what is
 * stored; typing in it replaces it.
 */
export function PaymentSettingsForm({
  status,
  webhookUrl,
  envOverride,
}: {
  status: PaymentStatus;
  webhookUrl: string;
  envOverride: boolean;
}) {
  const t = useTranslations('admin');
  const [state, action] = useActionState(savePaymentSettings, EMPTY);

  return (
    <form action={action} className="space-y-5 rounded-[var(--radius-card)] border border-line bg-white p-6">
      {envOverride && (
        <p className="flex items-start gap-2 rounded-[var(--radius-input)] bg-surface/70 p-4 text-[12px] leading-relaxed text-ink">
          <ShieldAlert className="mt-0.5 size-4 shrink-0 text-ink-muted" aria-hidden="true" />
          {t('envOverride')}
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1.5 block text-[13px] font-medium text-ink">{t('environment')}</span>
          <select
            name="environment"
            defaultValue={status.environment}
            className="w-full rounded-[var(--radius-input)] border border-line bg-white px-3 py-2.5 text-sm text-ink outline-none focus:border-brand-400"
          >
            <option value="sandbox">{t('envSandbox')}</option>
            <option value="live">{t('envLive')}</option>
          </select>
        </label>

        <Field
          label={t('currency')}
          name="currency"
          defaultValue={status.currency}
          error={state.error === 'currencyShape' ? t('errors.currencyShape') : undefined}
        />

        <Field
          label={t('clientId')}
          name="client_id"
          defaultValue={status.client_id}
          autoComplete="off"
          className="sm:col-span-2"
        />

        <Field
          label={t('clientSecret')}
          name="client_secret"
          type="password"
          autoComplete="new-password"
          hint={status.has_secret ? t('secretSet') : t('secretMissing')}
          className="sm:col-span-2"
        />

        <Field
          label={t('webhookId')}
          name="webhook_id"
          autoComplete="off"
          hint={status.has_webhook_id ? t('webhookSet') : t('webhookIdHint', { url: webhookUrl })}
          className="sm:col-span-2"
        />

        <Field
          label={t('merchantEmail')}
          name="merchant_email"
          type="email"
          defaultValue={status.merchant_email}
          autoComplete="off"
          className="sm:col-span-2"
        />
      </div>

      <label className="flex items-center gap-2.5 text-[13px] text-ink">
        <input
          type="checkbox"
          name="enabled"
          defaultChecked={status.enabled}
          className="size-4 rounded border-line text-brand-500"
        />
        {t('enablePayments')}
      </label>

      <p className="flex items-start gap-2 text-[11px] leading-relaxed text-ink-muted">
        <KeyRound className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
        {t('secretNeverShown')}
      </p>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" size="md">
          {t('save')}
        </Button>
        {state.ok && !state.error && (
          <span role="status" className="text-[12px] text-brand-600">
            {t('saved')}
          </span>
        )}
        {state.error && (
          <span role="alert" className="text-[12px] text-red-600">
            {t(`errors.${state.error}` as 'errors.saveFailed')}
          </span>
        )}
      </div>
    </form>
  );
}
