'use client';

import { useActionState } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { Field } from '@/components/ui/field';
import { FormMessage } from '@/components/auth/AuthCard';
import { SubmitButton } from '@/components/auth/SubmitButton';
import { login, type ActionState } from '@/app/actions/auth';

const EMPTY: ActionState = { ok: false };

export function LoginForm({ next, notice }: { next?: string; notice?: string }) {
  const t = useTranslations('auth');
  const [state, action] = useActionState(login, EMPTY);

  return (
    <form action={action} className="space-y-4" noValidate>
      {notice && <FormMessage tone="success">{notice}</FormMessage>}
      {state.message && <FormMessage tone="error">{state.message}</FormMessage>}

      {next && <input type="hidden" name="next" value={next} />}

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
        autoComplete="current-password"
        required
        error={state.fieldErrors?.['password']}
      />

      <div className="flex justify-end">
        <Link href="/forgot-password" className="text-xs text-brand-600 underline-offset-4 hover:underline">
          {t('forgotLink')}
        </Link>
      </div>

      <SubmitButton>{t('submitLogin')}</SubmitButton>
    </form>
  );
}
