'use client';

import { useActionState, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { grantEntitlement } from '@/app/actions/office';
import type { AdminState } from '@/app/actions/admin';

const EMPTY: AdminState = { ok: true };

export interface Option {
  id: string;
  title: string;
}

/**
 * Open access for one student by hand.
 *
 * The scope switch changes which target field is shown, but the server does
 * not trust the visible one — it reads the scope and takes the matching id,
 * nulling the other. A reason is required here and again in the RPC.
 */
export function GrantForm({
  userId,
  courses,
  cursus,
}: {
  userId: string;
  courses: Option[];
  cursus: Option[];
}) {
  const t = useTranslations('admin');
  const [state, action] = useActionState(grantEntitlement, EMPTY);
  const [scope, setScope] = useState<'course' | 'cursus' | 'site'>('course');

  return (
    <form action={action} className="space-y-4 rounded-[var(--radius-card)] border border-line bg-white p-5">
      <input type="hidden" name="userId" value={userId} />

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1.5 block text-[13px] font-medium text-ink">{t('grantScope')}</span>
          <select
            name="scope"
            value={scope}
            onChange={(e) => setScope(e.target.value as 'course' | 'cursus' | 'site')}
            className="w-full rounded-[var(--radius-input)] border border-line bg-white px-3 py-2.5 text-sm text-ink outline-none focus:border-brand-400"
          >
            <option value="course">{t('grantScopeCourse')}</option>
            <option value="cursus">{t('grantScopeCursus')}</option>
            <option value="site">{t('grantScopeSite')}</option>
          </select>
        </label>

        {scope === 'course' && (
          <label className="block">
            <span className="mb-1.5 block text-[13px] font-medium text-ink">{t('grantCourse')}</span>
            <select
              name="courseId"
              className="w-full rounded-[var(--radius-input)] border border-line bg-white px-3 py-2.5 text-sm text-ink outline-none focus:border-brand-400"
            >
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title}
                </option>
              ))}
            </select>
          </label>
        )}

        {scope === 'cursus' && (
          <>
            <label className="block">
              <span className="mb-1.5 block text-[13px] font-medium text-ink">{t('grantCursus')}</span>
              <select
                name="cursusId"
                className="w-full rounded-[var(--radius-input)] border border-line bg-white px-3 py-2.5 text-sm text-ink outline-none focus:border-brand-400"
              >
                {cursus.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title}
                  </option>
                ))}
              </select>
            </label>
            <Field label={t('grantYear')} name="yearIndex" type="number" min={1} max={10} defaultValue={1} />
          </>
        )}

        <label className="block">
          <span className="mb-1.5 block text-[13px] font-medium text-ink">{t('grantDelivery')}</span>
          <select
            name="delivery"
            className="w-full rounded-[var(--radius-input)] border border-line bg-white px-3 py-2.5 text-sm text-ink outline-none focus:border-brand-400"
          >
            <option value="online">{t('deliveryOnline')}</option>
            <option value="presentiel">{t('deliveryPresentiel')}</option>
          </select>
        </label>

        <Field label={t('grantDays')} name="days" type="number" min={1} max={3650} defaultValue={365} />
      </div>

      <Field label={t('grantReason')} name="reason" required maxLength={200} />

      <div className="flex items-center gap-3">
        <Button type="submit" size="sm">
          {t('grantSubmit')}
        </Button>
        {state.ok && !state.error && (
          <span role="status" className="text-[11px] text-brand-600">
            {t('saved')}
          </span>
        )}
        {state.error && (
          <span role="alert" className="text-[11px] text-red-600">
            {t(`errors.${state.error}` as 'errors.saveFailed')}
          </span>
        )}
      </div>
    </form>
  );
}
