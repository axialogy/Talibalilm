'use client';

import { useActionState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { CursusImageUpload } from '@/components/admin/CursusImageUpload';
import { saveCursus } from '@/app/actions/catalog';
import type { AdminState } from '@/app/actions/admin';
import { ActionForm } from '@/components/ui/action-form';

const EMPTY: AdminState = { ok: true };

export interface CursusView {
  id: string;
  slug: string;
  kind: 'module' | 'approfondi';
  title: string;
  subtitle: string;
  description: string;
  /** The written programme, one entry per line, shown on the home page. */
  details: string;
  /** Poster shown in the "Voir le cursus" accordion. */
  image_url: string | null;
  year_count: number;
  status: 'draft' | 'published' | 'archived';
  display_order: number;
}

export function CursusForm({ cursus }: { cursus?: CursusView }) {
  const t = useTranslations('admin');
  const [state, action] = useActionState(saveCursus, EMPTY);

  return (
    <ActionForm
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

      {/* The programme the student reads inside the cursus card. One entry per
          line — the card keeps the line breaks and bolds the section lines. */}
      <label className="block">
        <span className="mb-1.5 block text-[13px] font-medium text-ink">{t('cursusProgramme')}</span>
        <textarea
          name="details"
          rows={12}
          defaultValue={cursus?.details ?? ''}
          placeholder={t('cursusProgrammeHint')}
          className="w-full rounded-[var(--radius-input)] border border-line bg-white px-4 py-3 font-mono text-[13px] text-ink outline-none focus:border-brand-400"
        />
        <span className="mt-1.5 block text-[11px] text-ink-muted">{t('cursusProgrammeHint')}</span>
      </label>

      {cursus && <CursusImageUpload cursusId={cursus.id} imageUrl={cursus.image_url} />}

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
