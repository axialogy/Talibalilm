'use client';

import { useActionState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { CheckCircle2 } from 'lucide-react';
import { useRouter } from '@/i18n/navigation';
import { Field } from '@/components/ui/field';
import { ActionForm } from '@/components/ui/action-form';
import { SubmitButton } from '@/components/ui/submit-button';
import { saveCheckoutProfile, type ProfileState } from '@/app/actions/profile';
import { DEPARTMENTS } from '@/lib/validation/profile';
import type { StudentProfile } from '@/lib/data/profile';
import { cn } from '@/lib/utils';

const EMPTY: ProfileState = { ok: false };

const selectClass =
  'w-full rounded-[var(--radius-input)] border border-line bg-white px-4 py-2.5 text-sm text-ink outline-none transition-colors focus:border-brand-400';

/**
 * The enrolment details, asked once.
 *
 * They live on the profile, so a returning student finds them already filled
 * in and only edits what changed. The department is a select with one option
 * today: a value the office can group by, rather than free text that will
 * disagree with itself by the end of the first term.
 */
export function CheckoutProfileForm({
  profile,
  email,
  submitLabel,
  savedLabel,
}: {
  profile: StudentProfile | null;
  email: string | null;
  /** The dashboard says "Enregistrer" where the checkout says "continuer". */
  submitLabel?: string;
  savedLabel?: string;
}) {
  const t = useTranslations('checkout');
  const router = useRouter();
  const [state, action] = useActionState(saveCheckoutProfile, EMPTY);
  const errors = state.fieldErrors ?? {};

  // The action re-renders the route it was called from, so the wizard normally
  // advances by itself. This is the belt to that braces: if the client is
  // holding a cached payload, the refresh is what makes the saved profile
  // visible to the step logic.
  useEffect(() => {
    if (state.ok) router.refresh();
  }, [state.ok, router]);

  return (
    <ActionForm action={action} className="space-y-4" noValidate>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="checkout-department" className="mb-1.5 block text-[13px] font-medium text-ink">
            {t('department')}
          </label>
          <select
            id="checkout-department"
            name="department"
            required
            defaultValue={profile?.department || DEPARTMENTS[0]}
            aria-invalid={errors.department ? true : undefined}
            className={cn(selectClass, errors.department && 'border-red-500')}
          >
            {DEPARTMENTS.map((department) => (
              <option key={department} value={department}>
                {t('departmentSciencesIslamiques')}
              </option>
            ))}
          </select>
          {errors.department && (
            <p role="alert" className="mt-1.5 text-[11px] text-red-600">
              {errors.department}
            </p>
          )}
        </div>

        <div>
          <label htmlFor="checkout-civility" className="mb-1.5 block text-[13px] font-medium text-ink">
            {t('civility')}
          </label>
          <select
            id="checkout-civility"
            name="civility"
            required
            defaultValue={profile?.civility ?? ''}
            aria-invalid={errors.civility ? true : undefined}
            className={cn(selectClass, errors.civility && 'border-red-500')}
          >
            <option value="" disabled>
              {t('civilityChoose')}
            </option>
            <option value="madame">{t('civilityMadame')}</option>
            <option value="monsieur">{t('civilityMonsieur')}</option>
          </select>
          {errors.civility && (
            <p role="alert" className="mt-1.5 text-[11px] text-red-600">
              {errors.civility}
            </p>
          )}
        </div>

        <Field
          label={t('firstName')}
          name="firstName"
          required
          autoComplete="given-name"
          defaultValue={profile?.firstName ?? ''}
          error={errors.firstName}
        />
        <Field
          label={t('lastName')}
          name="lastName"
          required
          autoComplete="family-name"
          defaultValue={profile?.lastName ?? ''}
          error={errors.lastName}
        />

        <Field
          label={t('emailLabel')}
          name="email"
          type="email"
          value={email ?? ''}
          readOnly
          hint={t('emailFixedHint')}
          className="sm:col-span-2"
        />

        <Field
          label={t('phoneMobile')}
          name="phone"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          required
          defaultValue={profile?.phone ?? ''}
          error={errors.phone}
        />
        <Field
          label={t('phoneLandline')}
          name="phoneLandline"
          type="tel"
          inputMode="tel"
          defaultValue={profile?.phoneLandline ?? ''}
          error={errors.phoneLandline}
        />

        <Field
          label={t('birthDate')}
          name="birthDate"
          type="date"
          required
          defaultValue={profile?.birthDate ?? ''}
          error={errors.birthDate}
          className="sm:col-span-2"
        />

        <Field
          label={t('address')}
          name="address"
          required
          autoComplete="street-address"
          defaultValue={profile?.address ?? ''}
          error={errors.address}
          className="sm:col-span-2"
        />
        <Field
          label={t('postalCode')}
          name="postalCode"
          required
          autoComplete="postal-code"
          defaultValue={profile?.postalCode ?? ''}
          error={errors.postalCode}
        />
        <Field
          label={t('city')}
          name="city"
          required
          autoComplete="address-level2"
          defaultValue={profile?.city ?? ''}
          error={errors.city}
        />
      </div>

      {state.ok && (
        <p role="status" className="flex items-center gap-2 text-[13px] text-brand-600">
          <CheckCircle2 className="size-4 shrink-0" aria-hidden="true" />
          {savedLabel ?? t('infoSaved')}
        </p>
      )}

      {state.message && !state.ok && (
        <p role="alert" className="text-[13px] text-red-600">
          {state.message}
        </p>
      )}

      <SubmitButton block>{submitLabel ?? t('saveInfo')}</SubmitButton>
    </ActionForm>
  );
}
