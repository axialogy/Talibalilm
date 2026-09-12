'use client';

import { useActionState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { saveCursus } from '@/app/actions/catalog';
import type { AdminState } from '@/app/actions/admin';

const EMPTY: AdminState = { ok: true };

export interface CursusView {
  id: string;
  slug: string;
  kind: 'module' | 'approfondi';
  title: string;
  subtitle: string;
  description: string;
  year_count: number;
  status: 'draft' | 'published' | 'archived';
  display_order: number;
}

export function CursusForm({ cursus }: { cursus?: CursusView }) {
  const t = useTranslations('admin');
  const [state, action] = useActionState(saveCursus, EMPTY);

  return (
    <form
      action={action}
      className="space-y-4 rounded-[var(--radius-card)] border border-line bg-white p-5"
    >
      {cursus && <input type="hidden" name="id" value={cursus.id} />}

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={t('courseTitle')} name="title" defaultValue={cursus?.title ?? ''} required />
        <label className="block">
          <span className="mb-1.5 block text-[13px] font-medium text-ink">{t('cursusKind')}</span>
          <select
            name="kind"
            defaultValue={cursus?.kind ?? 'module'}
            className="w-full rounded-[var(--radius-input)] border border-line bg-white px-3 py-2.5 text-sm text-ink outline-none focus:border-brand-400"
          >
            <option value="module">{t('kindBase')}</option>
            <option value="approfondi">{t('kindApprofondi')}</option>
          </select>
        </label>

        <Field
          label={t('yearCount')}
          name="year_count"
          type="number"
          min={1}
          max={10}
          defaultValue={cursus?.year_count ?? 1}
        />

        <Field label={t('subtitle')} name="subtitle" defaultValue={cursus?.subtitle ?? ''} />

        <label className="block">
          <span className="mb-1.5 block text-[13px] font-medium text-ink">{t('status')}</span>
          <select
            name="status"
            defaultValue={cursus?.status ?? 'draft'}
            className="w-full rounded-[var(--radius-input)] border border-line bg-white px-3 py-2.5 text-sm text-ink outline-none focus:border-brand-400"
          >
            <option value="draft">{t('draft')}</option>
            <option value="published">{t('published')}</option>
            <option value="archived">{t('archived')}</option>
          </select>
        </label>
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
    </form>
  );
}
