'use client';

import { useActionState } from 'react';
import { useTranslations } from 'next-intl';
import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { deleteStudent, updateStudent } from '@/app/actions/office';
import type { AdminState } from '@/app/actions/admin';

const EMPTY: AdminState = { ok: true };

/**
 * Correcting and removing a student account.
 *
 * Deleting is offered only where it is actually possible: an account that has
 * bought something cannot be removed — `orders.user_id` is `on delete restrict`
 * so the sale is never orphaned — and for those, erasure is the right tool. The
 * button says which case applies rather than letting the office find out from a
 * failed save.
 */
export function StudentAccount({
  userId,
  fullName,
  phone,
  locale,
  hasOrders,
}: {
  userId: string;
  fullName: string;
  phone: string;
  locale: string;
  hasOrders: boolean;
}) {
  const t = useTranslations('admin');
  const [saveState, save] = useActionState(updateStudent, EMPTY);
  const [removeState, remove] = useActionState(deleteStudent, EMPTY);

  return (
    <div className="space-y-4">
      <form action={save} className="space-y-4 rounded-[var(--radius-card)] border border-line bg-white p-5">
        <input type="hidden" name="userId" value={userId} />

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t('studentName')} name="fullName" defaultValue={fullName} maxLength={120} />
          <Field label={t('studentPhone')} name="phone" defaultValue={phone} maxLength={32} />
        </div>

        <label className="block">
          <span className="mb-1.5 block text-[13px] font-medium text-ink">{t('studentLocale')}</span>
          <select
            name="locale"
            defaultValue={locale}
            className="w-full rounded-[var(--radius-input)] border border-line bg-white px-4 py-2.5 text-sm text-ink outline-none focus:border-brand-400"
          >
            <option value="fr">Français</option>
            <option value="en">English</option>
          </select>
        </label>

        <div className="flex items-center gap-3">
          <Button type="submit" size="sm">
            {t('save')}
          </Button>
          {saveState.ok && !saveState.error && (
            <span role="status" className="text-[11px] text-brand-600">
              {t('saved')}
            </span>
          )}
          {saveState.error && (
            <span role="alert" className="text-[12px] text-red-600">
              {t(`errors.${saveState.error}` as 'errors.saveFailed')}
            </span>
          )}
        </div>

        <p className="text-[11px] leading-relaxed text-ink-muted">{t('studentEmailNote')}</p>
      </form>

      {hasOrders ? (
        <p className="text-[12px] leading-relaxed text-ink-muted">{t('studentHasOrdersNote')}</p>
      ) : (
        <form
          action={remove}
          onSubmit={(event) => {
            if (!window.confirm(t('studentDeleteConfirm'))) event.preventDefault();
          }}
        >
          <input type="hidden" name="userId" value={userId} />
          <Button type="submit" size="sm" variant="ghost" className="text-red-600 hover:text-red-700">
            <Trash2 className="size-3.5" aria-hidden="true" />
            {t('studentDelete')}
          </Button>
          {removeState.error && (
            <p role="alert" className="mt-2 text-[12px] text-red-600">
              {t(`errors.${removeState.error}` as 'errors.saveFailed')}
            </p>
          )}
        </form>
      )}
    </div>
  );
}
