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
      {/* The title is the only decision: the URL is derived from it server-side. */}
      <Field label={t('courseTitle')} name="title" required />
      {state.error && (
        <p role="alert" className="text-[11px] text-red-600">
          {t(`errors.${state.error}` as 'errors.saveFailed')}
        </p>
      )}
      <SubmitButton size="md">{t('newCourse')}</SubmitButton>
    </form>
  );
}
