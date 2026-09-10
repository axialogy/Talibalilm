'use client';

import { useActionState } from 'react';
import { useTranslations } from 'next-intl';
import { Field } from '@/components/ui/field';
import { SubmitButton } from '@/components/auth/SubmitButton';
import { updateCourse, type AdminState } from '@/app/actions/admin';

const EMPTY: AdminState = { ok: true };

const LEVELS = ['all', 'beginner', 'intermediate', 'advanced'] as const;
const FORMATS = ['presentiel', 'visio', 'hybride'] as const;
const CATEGORIES = ['aqida', 'fiqh', 'coran', 'hadith', 'tafsir', 'langue', 'histoire'] as const;
const TONES = ['emerald', 'indigo', 'plum', 'sand', 'crimson', 'teal', 'night'] as const;

export interface CourseSettings {
  id: string;
  title: string;
  slug: string;
  subtitle: string;
  description: string;
  title_ar: string;
  category: string;
  level: string;
  format: string;
  tone: string;
  schedule: string;
  duration_weeks: number;
}

export function CourseSettingsForm({ course }: { course: CourseSettings }) {
  const t = useTranslations('admin');
  const tc = useTranslations('courses');
  const [state, action] = useActionState(updateCourse, EMPTY);

  return (
    <form action={action} className="space-y-3 rounded-[var(--radius-card)] border border-line bg-white p-5">
      <input type="hidden" name="id" value={course.id} />

      <Field label={t('courseTitle')} name="title" defaultValue={course.title} required />
      <Field label={t('slug')} name="slug" defaultValue={course.slug} required />
      <Field label={t('titleAr')} name="title_ar" defaultValue={course.title_ar} dir="rtl" />
      <Field label={t('subtitle')} name="subtitle" defaultValue={course.subtitle} />

      <label className="block">
        <span className="mb-1.5 block text-[13px] font-medium text-ink">{t('description')}</span>
        <textarea
          name="description"
          rows={5}
          defaultValue={course.description}
          className="w-full rounded-[var(--radius-input)] border border-line bg-white px-4 py-3 text-sm text-ink outline-none transition-colors focus:border-brand-400"
        />
      </label>

      <div className="grid gap-3 sm:grid-cols-2">
        <Select label={tc('filterSubject')} name="category" value={course.category} options={CATEGORIES.map((c) => [c, tc(`category.${c}`)])} />
        <Select label={tc('filterLevel')} name="level" value={course.level} options={LEVELS.map((l) => [l, tc(`level.${l}`)])} />
        <Select label={tc('detail.facts.format')} name="format" value={course.format} options={FORMATS.map((f) => [f, tc(`format.${f}`)])} />
        <Select label="Ton" name="tone" value={course.tone} options={TONES.map((x) => [x, x])} />
      </div>

      <Field label={tc('detail.facts.schedule')} name="schedule" defaultValue={course.schedule} />
      <Field
        label={tc('detail.facts.duration')}
        name="duration_weeks"
        type="number"
        min={0}
        defaultValue={course.duration_weeks}
      />

      {state.error && (
        <p role="alert" className="text-[11px] text-red-600">
          {state.error === 'duplicate' ? `${t('slug')} — déjà utilisé` : state.error}
        </p>
      )}
      {state.ok && !state.error && (
        <p className="text-[11px] text-brand-600" role="status">
          {t('saved')}
        </p>
      )}

      <SubmitButton size="md">{t('save')}</SubmitButton>
    </form>
  );
}

function Select({
  label,
  name,
  value,
  options,
}: {
  label: string;
  name: string;
  value: string;
  options: [string, string][];
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[13px] font-medium text-ink">{label}</span>
      <select
        name={name}
        defaultValue={value}
        className="w-full rounded-[var(--radius-input)] border border-line bg-white px-3 py-2.5 text-sm text-ink outline-none transition-colors focus:border-brand-400"
      >
        {options.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
    </label>
  );
}
