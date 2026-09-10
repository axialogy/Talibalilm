'use client';

import { useActionState } from 'react';
import { useTranslations } from 'next-intl';
import { Field } from '@/components/ui/field';
import { FormMessage } from '@/components/auth/AuthCard';
import { SubmitButton } from '@/components/auth/SubmitButton';
import { forgotPassword, resetPassword, type ActionState } from '@/app/actions/auth';

const EMPTY: ActionState = { ok: false };

export function ForgotPasswordForm() {
  const t = useTranslations('auth');
  const [state, action] = useActionState(forgotPassword, EMPTY);

  return (
    <form action={action} className="space-y-4" noValidate>
      {state.message && (
        <FormMessage tone={state.ok ? 'success' : 'error'}>{state.message}</FormMessage>
      )}
      <Field
        label={t('email')}
        name="email"
        type="email"
        autoComplete="email"
        required
        error={state.fieldErrors?.['email']}
      />
      <SubmitButton>{t('submitForgot')}</SubmitButton>
    </form>
  );
}

export function ResetPasswordForm() {
  const t = useTranslations('auth');
  const [state, action] = useActionState(resetPassword, EMPTY);

  return (
    <form action={action} className="space-y-4" noValidate>
      {state.message && <FormMessage tone="error">{state.message}</FormMessage>}
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
      <SubmitButton>{t('submitReset')}</SubmitButton>
    </form>
  );
}
