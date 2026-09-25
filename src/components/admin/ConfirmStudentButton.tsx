'use client';

import { useActionState } from 'react';
import { useTranslations } from 'next-intl';
import { MailCheck } from 'lucide-react';
import { ActionForm } from '@/components/ui/action-form';
import { ActionError } from '@/components/admin/ActionError';
import { SaveButton } from '@/components/admin/SaveButton';
import { confirmStudentEmail } from '@/app/actions/office';
import type { AdminState } from '@/app/actions/admin';

const IDLE: AdminState = { ok: false };

/**
 * Confirm the e-mail and activate the account, in one press.
 *
 * The two used to be separate buttons on the student page: one confirmed the
 * address, another let the account order. Nobody wants to press both, and
 * forgetting the second left a student who could sign in but not buy. The
 * action behind this does both, plus clears the "Nouveau" flag, so this is the
 * only registration button the office needs. It is idempotent, which is what
 * lets it sit on every row of the list.
 */
export function ConfirmStudentButton({
  userId,
  label,
  size = 'sm',
  variant = 'primary',
}: {
  userId: string;
  label?: string;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'primary' | 'outline' | 'ghost';
}) {
  const t = useTranslations('admin');
  const [state, action] = useActionState(confirmStudentEmail, IDLE);

  return (
    <ActionForm action={action} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="userId" value={userId} />
      <SaveButton
        state={state}
        label={label ?? t('studentActivateCta')}
        savedLabel={t('studentActivated')}
        size={size}
        variant={variant}
        icon={<MailCheck aria-hidden="true" />}
      />
      <ActionError state={state} />
    </ActionForm>
  );
}
