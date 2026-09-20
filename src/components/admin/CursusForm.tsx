'use client';

import { useActionState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { CursusImageUpload } from '@/components/admin/CursusImageUpload';
import { ActionError } from '@/components/admin/ActionError';
import { saveCursus } from '@/app/actions/catalog';
import type { AdminState } from '@/app/actions/admin';
import { ActionForm } from '@/components/ui/action-form';

const EMPTY: AdminState = { ok: true };

const SELECT =
  'w-full rounded-[var(--radius-input)] border border-line bg-white px-3 py-2.5 text-sm text-ink outline-none focus:border-brand-400';

export interface CursusView {
  id: string;
  title: string;
  description: string;
  /** Poster shown in the "Voir le cursus" accordion. */
  image_url: string | null;
  year_count: number;
  status: 'draft' | 'published' | 'archived';
}

/**
 * Create a cursus, or rename one.
 *
 * Creating starts from a module the school has already made: the dropdown
 * names the cursus after it, that module joins year one, and the price typed
 * here becomes every year's price in both modes. The programme grid on the tab
 * is where the rest of the modules are ticked in.
 *
 * The form is deliberately short. The type is settled at creation, and the
 * written programme the home page shows is the grid, not a text box.
 */
export function CursusForm({
  cursus,
  courses,
}: {
  cursus?: CursusView;
  /** The modules a new cursus can be named after. */
  courses: { id: string; title: string }[];
}) {
  const t = useTranslations('admin');
  const [state, action] = useActionState(saveCursus, EMPTY);

  return (
    <ActionForm
      action={action}
      className="space-y-4 rounded-[var(--radius-card)] border border-line bg-white p-5"
    >
      {cursus && <input type="hidden" name="id" value={cursus.id} />}

      <div className="grid gap-3 sm:grid-cols-2">
        {cursus ? (
          <Field
            label={t('cursusTitle')}
            name="title"
            defaultValue={cursus.title}
            required
          />
        ) : (
          <label className="block">
            <span className="mb-1.5 block text-[13px] font-medium text-ink">{t('course')}</span>
            <select
              name="course_id"
              required
              defaultValue={courses[0]?.id ?? ''}
              className={SELECT}
            >
              {courses.map((course) => (
                <option key={course.id} value={course.id}>
                  {course.title}
                </option>
              ))}
            </select>
          </label>
        )}

        <Field
          label={t('yearCount')}
          name="year_count"
          type="number"
          min={1}
          max={10}
          defaultValue={cursus?.year_count ?? 1}
        />

        <label className="block">
          <span className="mb-1.5 block text-[13px] font-medium text-ink">{t('status')}</span>
          <select name="status" defaultValue={cursus?.status ?? 'draft'} className={SELECT}>
            <option value="draft">{t('draft')}</option>
            <option value="published">{t('published')}</option>
            <option value="archived">{t('archived')}</option>
          </select>
        </label>

        {!cursus && (
          <Field
            label={t('cursusTariff')}
            name="price"
            inputMode="decimal"
            placeholder="900"
            hint={t('cursusPriceHint')}
          />
        )}
      </div>

      <label className="block">
        <span className="mb-1.5 block text-[13px] font-medium text-ink">{t('description')}</span>
        <textarea
          name="description"
          rows={3}
          defaultValue={cursus?.description ?? ''}
          className="w-full rounded-[var(--radius-input)] border border-line bg-white px-4 py-3 text-sm text-ink outline-none focus:border-brand-400"
        />
      </label>

      {cursus && <CursusImageUpload cursusId={cursus.id} imageUrl={cursus.image_url} />}

      <ActionError state={state} />

      <div className="flex items-center gap-3">
        <Button type="submit" size="sm">
          {t('save')}
        </Button>
        {state.ok && !state.error && (
          <span role="status" className="text-[11px] text-brand-600">
            {t('saved')}
          </span>
        )}
      </div>
    </ActionForm>
  );
}
