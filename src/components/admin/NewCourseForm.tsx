'use client';

import { useActionState } from 'react';
import { useTranslations } from 'next-intl';
import { Field } from '@/components/ui/field';
import { SubmitButton } from '@/components/auth/SubmitButton';
import { createCourse, type AdminState } from '@/app/actions/admin';
import { ActionError } from '@/components/admin/ActionError';

const EMPTY: AdminState = { ok: true };

export function NewCourseForm() {
  const t = useTranslations('admin');
  const [state, action] = useActionState(createCourse, EMPTY);

  return (
    <form action={action} className="mt-4 space-y-3">
      {/* The title is the only decision: the URL is derived from it server-side. */}
      <Field label={t('courseTitle')} name="title" required />
      <ActionError state={state} />
      <SubmitButton size="md">{t('newCourse')}</SubmitButton>
    </form>
  );
}
