'use client';

import { useActionState } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { Field } from '@/components/ui/field';
import { FormMessage } from '@/components/auth/AuthCard';
import { SubmitButton } from '@/components/auth/SubmitButton';
import { register, type ActionState } from '@/app/actions/auth';

const EMPTY: ActionState = { ok: false };

export function RegisterForm() {
  const t = useTranslations('auth');
  const [state, action] = useActionState(register, EMPTY);

  return (
    <form action={action} className="space-y-4" noValidate>
      {state.message && <FormMessage tone="error">{state.message}</FormMessage>}

      <Field
        label={t('fullName')}
        name="fullName"
        autoComplete="name"
        required
        error={state.fieldErrors?.['fullName']}
      />
      <Field
        label={t('email')}
        name="email"
        type="email"
        autoComplete="email"
        required
        error={state.fieldErrors?.['email']}
      />
      <Field
        label={t('password')}
        name="password"
        type="password"
        autoComplete="new-password"
        required
        hint={t('passwordHint')}
        error={state.fieldErrors?.['password']}
      />
      <Field
        label={t('passwordConfirm')}
        name="passwordConfirm"
        type="password"
        autoComplete="new-password"
        required
        error={state.fieldErrors?.['passwordConfirm']}
      />

      <div>
        <label className="flex items-start gap-2.5 text-[12px] leading-relaxed text-ink-muted">
          <input
            type="checkbox"
            name="acceptTerms"
            required
            className="mt-0.5 size-4 shrink-0 rounded border-line text-brand-500 focus-visible:outline-brand-500"
          />
          <span>
            {t.rich('acceptTerms', {
              terms: (chunks) => (
                <Link href="/legal/terms" className="text-brand-600 underline underline-offset-4">
                  {chunks}
                </Link>
              ),
              privacy: (chunks) => (
                <Link href="/legal/privacy" className="text-brand-600 underline underline-offset-4">
                  {chunks}
                </Link>
              ),
            })}
          </span>
        </label>
        {state.fieldErrors?.['acceptTerms'] && (
          <p role="alert" className="mt-1.5 text-[11px] text-red-600">
            {state.fieldErrors['acceptTerms']}
          </p>
        )}
      </div>

      <SubmitButton>{t('submitRegister')}</SubmitButton>
    </form>
  );
}
