'use client';

import { useActionState } from 'react';
import { useTranslations } from 'next-intl';
import { Field } from '@/components/ui/field';
import { SubmitButton } from '@/components/auth/SubmitButton';
import { createCourse, type AdminState } from '@/app/actions/admin';

const EMPTY: AdminState = { ok: true };

export function NewCourseForm() {
  const t = useTranslations('admin');
  const [state, action] = useActionState(createCourse, EMPTY);

  return (
    <form action={action} className="mt-4 space-y-3">
      <Field label={t('courseTitle')} name="title" required />
      {/* Left blank, the slug is derived from the title server-side. */}
      <Field label={t('slug')} name="slug" placeholder="fiqh-al-ibadat" />
      {state.error && (
        <p role="alert" className="text-[11px] text-red-600">
          {state.error === 'duplicate' ? `${t('slug')} — déjà utilisé` : t('save')}
        </p>
      )}
      <SubmitButton size="md">{t('newCourse')}</SubmitButton>
    </form>
  );
}
