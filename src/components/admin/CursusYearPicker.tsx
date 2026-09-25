'use client';

import { useActionState, useState } from 'react';
import { useTranslations } from 'next-intl';
import { ChevronDown } from 'lucide-react';
import { ActionError } from '@/components/admin/ActionError';
import { SaveButton } from '@/components/admin/SaveButton';
import { setCursusYearModules } from '@/app/actions/catalog';
import type { AdminState } from '@/app/actions/admin';
import { ActionForm } from '@/components/ui/action-form';

const IDLE: AdminState = { ok: false };

/**
 * The modules of one year, from a dropdown of checkboxes.
 *
 * What this replaces was a matrix of every module against every year in each
 * mode — nineteen rows by three columns by two tables to answer a question the
 * school thinks of as one sentence: "what does year 1 teach?". The mode is not
 * a second paywall, so a tick writes both; what remains to choose is the
 * year's subjects.
 *
 * The list stays mounted when the dropdown is closed — an unmounted checkbox
 * submits nothing, and saving with the panel shut would read as "remove every
 * module of this year".
 */
export function CursusYearPicker({
  cursusId,
  year,
  courses,
  selected,
}: {
  cursusId: string;
  year: number;
  courses: { id: string; title: string }[];
  selected: string[];
}) {
  const t = useTranslations('admin');
  const [state, save] = useActionState(setCursusYearModules, IDLE);
  const [open, setOpen] = useState(false);
  const [chosen, setChosen] = useState<Set<string>>(() => new Set(selected));

  function toggle(id: string) {
    setChosen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <ActionForm
      action={save}
      className="rounded-[var(--radius-card)] border border-line bg-white"
    >
      <input type="hidden" name="cursus_id" value={cursusId} />
      <input type="hidden" name="year_index" value={year} />

      <div className="flex flex-wrap items-center gap-3 px-4 py-3 text-[13px]">
        <span className="min-w-24 font-medium text-ink">
          {t('yearIndex')} {year}
        </span>

        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          className="inline-flex items-center gap-2 rounded-[var(--radius-input)] border border-line px-3 py-1.5 text-ink hover:bg-brand-50"
        >
          {t('programmePick')}
          <span className="text-ink-muted">{t('programmeCount', { count: chosen.size })}</span>
          <ChevronDown
            className={`size-3.5 transition-transform ${open ? 'rotate-180' : ''}`}
            aria-hidden="true"
          />
        </button>

        <SaveButton state={state} label={t('save')} size="sm" variant="ghost" />
      </div>

      <div
        className={`max-h-64 overflow-y-auto border-t border-line px-4 py-3 ${
          open ? 'space-y-1' : 'hidden'
        }`}
      >
        {courses.map((course) => (
          <label key={course.id} className="flex items-center gap-2 text-[13px] text-ink">
            <input
              type="checkbox"
              name="course_ids"
              value={course.id}
              checked={chosen.has(course.id)}
              onChange={() => toggle(course.id)}
              className="size-4 accent-brand-500"
            />
            {course.title}
          </label>
        ))}
      </div>

      <ActionError state={state} className="px-4 pb-3" />
    </ActionForm>
  );
}
