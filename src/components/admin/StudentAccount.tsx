'use client';

import { useActionState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { ActionError } from '@/components/admin/ActionError';
import { ConfirmStudentButton } from '@/components/admin/ConfirmStudentButton';
import { SaveButton } from '@/components/admin/SaveButton';
import { Field } from '@/components/ui/field';
import { Badge } from '@/components/ui/badge';
import { setStudentApproval, updateStudent } from '@/app/actions/office';
import type { AdminState } from '@/app/actions/admin';
import { ActionForm } from '@/components/ui/action-form';

const IDLE: AdminState = { ok: false };

/**
 * Correcting a student account, and opening or closing it.
 *
 * One registration button, not three. `ConfirmStudentButton` confirms the
 * address AND activates the account AND clears the "Nouveau" flag — the three
 * used to be separate controls, and forgetting the second left a student who
 * could sign in but not buy. What is left here is the correction form, plus a
 * way back for a decision that has to be undone: a mistake, a dispute.
 */
export function StudentAccount({
  userId,
  fullName,
  phone,
  phoneLandline,
  locale,
  approved,
  details,
}: {
  userId: string;
  fullName: string;
  phone: string;
  phoneLandline: string;
  locale: string;
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
  const [saveState, save] = useActionState(updateStudent, IDLE);
  const [approvalState, setApproval] = useActionState(setStudentApproval, IDLE);

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
          {t('studentActivateNote')}
        </p>

        {approved ? (
          <form action={setApproval} className="mt-3">
            <input type="hidden" name="userId" value={userId} />
            <input type="hidden" name="approve" value="no" />
            <Button type="submit" size="sm" variant="outline">
              {t('deactivateCta')}
            </Button>
            <ActionError state={approvalState} />
          </form>
        ) : (
          <div className="mt-3">
            <ConfirmStudentButton userId={userId} label={t('studentActivateCta')} />
          </div>
        )}
      </div>

      <ActionForm
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

        <div className="flex flex-wrap items-center gap-3">
          <SaveButton state={saveState} label={t('save')} size="sm" />
          <ActionError state={saveState} />
        </div>

        <p className="text-[11px] leading-relaxed text-ink-muted">{t('studentEmailNote')}</p>
      </ActionForm>
    </div>
  );
}
