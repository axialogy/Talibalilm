'use client';

import { useActionState } from 'react';
import { useTranslations } from 'next-intl';
import { MailCheck, ShieldCheck, Trash2, Undo2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Badge } from '@/components/ui/badge';
import {
  confirmStudentEmail,
  deleteStudent,
  setStudentApproval,
  updateStudent,
} from '@/app/actions/office';
import type { AdminState } from '@/app/actions/admin';

const EMPTY: AdminState = { ok: true };

/**
 * For the one form that reports success.
 *
 * `EMPTY` above is `ok: true`, which is fine for forms that only ever show an
 * error — and wrong here, where `ok` would make a freshly opened panel claim
 * the account had just been activated.
 */
const IDLE: AdminState = { ok: false };

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
  approved,
}: {
  userId: string;
  fullName: string;
  phone: string;
  locale: string;
  hasOrders: boolean;
  /** Has an admin let this account in yet? */
  approved: boolean;
}) {
  const t = useTranslations('admin');
  const [saveState, save] = useActionState(updateStudent, EMPTY);
  const [removeState, remove] = useActionState(deleteStudent, EMPTY);
  const [confirmState, confirmEmail] = useActionState(confirmStudentEmail, IDLE);
  const [approvalState, setApproval] = useActionState(setStudentApproval, IDLE);

  return (
    <div className="space-y-4">
      <form
        action={save}
        className="space-y-4 rounded-[var(--radius-card)] border border-line bg-white p-5"
      >
        <input type="hidden" name="userId" value={userId} />

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t('studentName')} name="fullName" defaultValue={fullName} maxLength={120} />
          <Field label={t('studentPhone')} name="phone" defaultValue={phone} maxLength={32} />
        </div>

        <label className="block">
          <span className="mb-1.5 block text-[13px] font-medium text-ink">
            {t('studentLocale')}
          </span>
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

      {/*
        Letting the account in. Approving sends the student the welcome
        message; the database returns an address only on a real change, so
        pressing this twice cannot send it twice.
      */}
      <form
        action={setApproval}
        className={`rounded-[var(--radius-card)] border p-5 ${
          approved ? 'border-line bg-white' : 'border-gold-300 bg-gold-50/60'
        }`}
      >
        <input type="hidden" name="userId" value={userId} />
        <input type="hidden" name="approve" value={approved ? 'no' : 'yes'} />

        <div className="flex flex-wrap items-center gap-2">
          <p className="text-[13px] font-medium text-ink">{t('studentApproval')}</p>
          <Badge variant={approved ? 'success' : 'warn'}>
            {approved ? t('studentApproved') : t('studentPending')}
          </Badge>
        </div>
        <p className="mt-1 text-[11px] leading-relaxed text-ink-muted">
          {approved ? t('studentApprovedNote') : t('studentPendingNote')}
        </p>

        <Button type="submit" size="sm" variant={approved ? 'ghost' : 'primary'} className="mt-3">
          {approved ? (
            <Undo2 className="size-3.5" aria-hidden="true" />
          ) : (
            <ShieldCheck className="size-3.5" aria-hidden="true" />
          )}
          {approved ? t('studentUnapprove') : t('studentApprove')}
        </Button>

        {approvalState.error && (
          <p role="alert" className="mt-2 text-[12px] text-red-600">
            {t(`errors.${approvalState.error}` as 'errors.saveFailed')}
          </p>
        )}
      </form>

      {/*
        Opening an account whose confirmation e-mail never arrived.

        Supabase will not let a student sign in until the address is confirmed,
        and confirming it means receiving a message — so a broken mail path
        strands somebody who can do nothing about it themselves. Idempotent, so
        it is harmless on an account that is already active.
      */}
      <form
        action={confirmEmail}
        className="rounded-[var(--radius-card)] border border-line bg-white p-5"
      >
        <input type="hidden" name="userId" value={userId} />
        <p className="text-[13px] font-medium text-ink">{t('studentActivate')}</p>
        <p className="mt-1 text-[11px] leading-relaxed text-ink-muted">
          {t('studentActivateNote')}
        </p>
        <Button type="submit" size="sm" variant="outline" className="mt-3">
          <MailCheck className="size-3.5" aria-hidden="true" />
          {t('studentActivateCta')}
        </Button>
        {confirmState.error && (
          <p role="alert" className="mt-2 text-[12px] text-red-600">
            {t(`errors.${confirmState.error}` as 'errors.saveFailed')}
          </p>
        )}
        {confirmState.ok && (
          <p role="status" className="mt-2 text-[12px] text-brand-600">
            {t('studentActivated')}
          </p>
        )}
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
          <Button
            type="submit"
            size="sm"
            variant="ghost"
            className="text-red-600 hover:text-red-700"
          >
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
