'use client';

import { useActionState } from 'react';
import { useTranslations } from 'next-intl';
import { Check, MailCheck, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ActionError } from '@/components/admin/ActionError';
import { Field } from '@/components/ui/field';
import { Badge } from '@/components/ui/badge';
import {
  confirmStudentEmail,
  deleteStudent,
  markStudentReviewed,
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
  phoneLandline,
  locale,
  hasOrders,
  reviewed,
  approved,
  details,
}: {
  userId: string;
  fullName: string;
  phone: string;
  phoneLandline: string;
  locale: string;
  hasOrders: boolean;
  /** Has the office looked at this registration yet? */
  reviewed: boolean;
  /** Has the office let this account buy? */
  approved: boolean;
  /** The enrolment form's fields, so the office can correct a typo. */
  details: {
    civility: string | null;
    firstName: string;
    lastName: string;
    birthDate: string | null;
    address: string;
    postalCode: string;
    city: string;
    department: string;
  };
}) {
  const t = useTranslations('admin');
  const [saveState, save] = useActionState(updateStudent, EMPTY);
  const [approvalState, setApproval] = useActionState(setStudentApproval, EMPTY);
  const [removeState, remove] = useActionState(deleteStudent, EMPTY);
  const [confirmState, confirmEmail] = useActionState(confirmStudentEmail, IDLE);
  const [seenState, markSeen] = useActionState(markStudentReviewed, IDLE);

  return (
    <div className="space-y-4">
      <div
        className={
          approved
            ? 'rounded-[var(--radius-card)] border border-brand-200 bg-brand-50/60 p-5'
            : 'rounded-[var(--radius-card)] border border-gold-300 bg-gold-50/60 p-5'
        }
      >
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-[13px] font-medium text-ink">{t('studentApproval')}</p>
          <Badge variant={approved ? 'success' : 'warn'}>
            {approved ? t('studentApproved') : t('studentPendingApproval')}
          </Badge>
        </div>
        <p className="mt-1 text-[11px] leading-relaxed text-ink-muted">
          {t('studentApprovalLead')}
        </p>

        <form action={setApproval} className="mt-3">
          <input type="hidden" name="userId" value={userId} />
          <input type="hidden" name="approve" value={approved ? 'no' : 'yes'} />
          <Button type="submit" size="sm" variant={approved ? 'outline' : 'primary'}>
            {approved ? t('unapproveCta') : t('approveCta')}
          </Button>
        </form>

        {approvalState.ok && !approvalState.error && (
          <p role="status" className="mt-2 text-[12px] text-brand-600">
            {t('saved')}
          </p>
        )}
        <ActionError state={approvalState} />
      </div>

      <form
        action={save}
        className="space-y-4 rounded-[var(--radius-card)] border border-line bg-white p-5"
      >
        <input type="hidden" name="userId" value={userId} />

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t('studentName')} name="fullName" defaultValue={fullName} maxLength={120} />
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
        </div>

        {/* The enrolment details, as the student filled them in at checkout.
            The office reads them and can correct a typo; the shape constraints
            in the database still hold whatever is typed here. */}
        <div className="border-t border-line pt-4">
          <p className="text-[12px] font-medium text-ink">{t('studentEnrolment')}</p>

          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1.5 block text-[13px] font-medium text-ink">
                {t('studentCivility')}
              </span>
              <select
                name="civility"
                defaultValue={details.civility ?? ''}
                className="w-full rounded-[var(--radius-input)] border border-line bg-white px-4 py-2.5 text-sm text-ink outline-none focus:border-brand-400"
              >
                <option value="">—</option>
                <option value="madame">Madame</option>
                <option value="monsieur">Monsieur</option>
              </select>
            </label>
            <Field
              label={t('studentBirthDate')}
              name="birthDate"
              type="date"
              defaultValue={details.birthDate ?? ''}
            />

            <Field
              label={t('studentFirstName')}
              name="firstName"
              defaultValue={details.firstName}
              maxLength={60}
            />
            <Field
              label={t('studentLastName')}
              name="lastName"
              defaultValue={details.lastName}
              maxLength={60}
            />

            <Field label={t('studentPhone')} name="phone" defaultValue={phone} maxLength={32} />
            <Field
              label={t('studentPhoneLandline')}
              name="phoneLandline"
              defaultValue={phoneLandline}
              maxLength={32}
            />

            <Field
              label={t('studentDepartment')}
              name="department"
              defaultValue={details.department}
              maxLength={120}
            />
            <Field
              label={t('studentAddress')}
              name="address"
              defaultValue={details.address}
              maxLength={200}
            />
            <Field
              label={t('studentPostalCode')}
              name="postalCode"
              defaultValue={details.postalCode}
              maxLength={16}
            />
            <Field label={t('studentCity')} name="city" defaultValue={details.city} maxLength={120} />
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button type="submit" size="sm">
            {t('save')}
          </Button>
          {saveState.ok && !saveState.error && (
            <span role="status" className="text-[11px] text-brand-600">
              {t('saved')}
            </span>
          )}
          <ActionError state={saveState} />
        </div>

        <p className="text-[11px] leading-relaxed text-ink-muted">{t('studentEmailNote')}</p>
      </form>

      {/*
        A registration nobody has opened yet.

        This clears a notification and nothing else — the student could already
        enrol and pay before anybody pressed it. Once pressed the panel is gone
        rather than switching to a second state, because there is no second
        thing to say: the badge existed to be cleared.
      */}
      {!reviewed && (
        <form
          action={markSeen}
          className="rounded-[var(--radius-card)] border border-gold-300 bg-gold-50/60 p-5"
        >
          <input type="hidden" name="userId" value={userId} />

          <div className="flex flex-wrap items-center gap-2">
            <p className="text-[13px] font-medium text-ink">{t('studentNew')}</p>
            <Badge variant="warn">{t('studentPending')}</Badge>
          </div>
          <p className="mt-1 text-[11px] leading-relaxed text-ink-muted">{t('studentNewNote')}</p>

          <Button type="submit" size="sm" className="mt-3">
            <Check className="size-3.5" aria-hidden="true" />
            {t('studentSeenCta')}
          </Button>

          <ActionError state={seenState} />
        </form>
      )}

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
        <ActionError state={confirmState} />
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
          <ActionError state={removeState} />
        </form>
      )}
    </div>
  );
}
