'use client';

import { useActionState, useEffect } from 'react';
import { useRouter } from '@/i18n/navigation';
import { useTranslations } from 'next-intl';
import { KeyRound, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { SubmitButton } from '@/components/ui/submit-button';
import { setAdminPin, unlockAdminPin, type PinState } from '@/app/actions/security';

const EMPTY: PinState = { ok: false };

/**
 * The PIN in front of the PayPal configuration.
 *
 * Two states: no PIN yet (set one), or a PIN to enter. On success the server
 * sets a short-lived cookie and the page is refreshed — the form underneath
 * appears because the SERVER says so, not because this component decided it.
 *
 * The errors are the honest ones: a wrong PIN, a lockout with its window, a
 * missing STEPUP_SECRET that makes the lock impossible to use. None of them
 * leaves the office guessing which of the three it was.
 */
export function PinGate({ pinSet, configured }: { pinSet: boolean; configured: boolean }) {
  const t = useTranslations('admin');
  const router = useRouter();
  const [unlockState, unlock] = useActionState(unlockAdminPin, EMPTY);
  const [setState, setPin] = useActionState(setAdminPin, EMPTY);

  useEffect(() => {
    if (unlockState.ok || setState.ok) router.refresh();
  }, [unlockState.ok, setState.ok, router]);

  const message = (state: PinState) =>
    state.error ? t(`security.${state.error}` as 'security.pinWrong') : null;

  if (!configured) {
    return (
      <div className="max-w-xl rounded-[var(--radius-card)] border border-gold-300 bg-gold-50/60 p-5">
        <p className="flex items-center gap-2 text-[13px] font-medium text-ink">
          <ShieldAlert className="size-4 text-ink-muted" aria-hidden="true" />
          {t('security.pinTitle')}
        </p>
        <p className="mt-2 text-[12px] leading-relaxed text-ink-muted">
          {t('security.pinUnconfigured')}
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-xl rounded-[var(--radius-card)] border border-line bg-white p-5">
      <p className="flex items-center gap-2 text-[13px] font-medium text-ink">
        <KeyRound className="size-4 text-ink-muted" aria-hidden="true" />
        {pinSet ? t('security.pinUnlockTitle') : t('security.pinSetTitle')}
      </p>
      <p className="mt-2 text-[12px] leading-relaxed text-ink-muted">
        {pinSet ? t('security.pinUnlockLead') : t('security.pinSetLead')}
      </p>

      {pinSet ? (
        <form action={unlock} className="mt-4 space-y-3">
          <Field
            label={t('security.pinLabel')}
            name="pin"
            type="password"
            inputMode="numeric"
            autoComplete="off"
            maxLength={8}
          />
          <SubmitButton size="sm">{t('security.pinUnlockCta')}</SubmitButton>
        </form>
      ) : (
        <form action={setPin} className="mt-4 space-y-3">
          <Field
            label={t('security.pinLabel')}
            name="pin"
            type="password"
            inputMode="numeric"
            autoComplete="new-password"
            maxLength={8}
            hint={t('security.pinHint')}
          />
          <Field
            label={t('security.pinConfirm')}
            name="confirm"
            type="password"
            inputMode="numeric"
            autoComplete="new-password"
            maxLength={8}
          />
          <SubmitButton size="sm">{t('security.pinSetCta')}</SubmitButton>
        </form>
      )}

      {(message(unlockState) || message(setState)) && (
        <p role="alert" className="mt-3 text-[12px] text-red-600">
          {message(unlockState) ?? message(setState)}
        </p>
      )}

      {pinSet && (
        <form action={setPin} className="mt-5 border-t border-line pt-4">
          <p className="text-[12px] font-medium text-ink">{t('security.pinChangeTitle')}</p>
          <div className="mt-2 grid gap-3 sm:grid-cols-3">
            <Field
              label={t('security.pinCurrent')}
              name="currentPin"
              type="password"
              inputMode="numeric"
              autoComplete="off"
              maxLength={8}
            />
            <Field
              label={t('security.pinNew')}
              name="pin"
              type="password"
              inputMode="numeric"
              autoComplete="new-password"
              maxLength={8}
            />
            <Field
              label={t('security.pinConfirm')}
              name="confirm"
              type="password"
              inputMode="numeric"
              autoComplete="new-password"
              maxLength={8}
            />
          </div>
          <Button type="submit" size="sm" variant="outline" className="mt-3">
            {t('security.pinChangeCta')}
          </Button>
        </form>
      )}
    </div>
  );
}
