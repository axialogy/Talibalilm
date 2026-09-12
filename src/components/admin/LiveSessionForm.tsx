'use client';

import { useActionState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { createLiveSession } from '@/app/actions/live';
import type { AdminState } from '@/app/actions/admin';

const EMPTY: AdminState = { ok: true };

/** Schedule a class against a course. The course is what decides who may attend. */
export function LiveSessionForm({ courses }: { courses: { id: string; title: string }[] }) {
  const t = useTranslations('admin');
  const [state, action] = useActionState(createLiveSession, EMPTY);

  const field =
    'w-full rounded-[var(--radius-input)] border border-line bg-white px-4 py-3 text-sm text-ink outline-none focus:border-brand-400';

  return (
    <form action={action} className="space-y-4 rounded-[var(--radius-card)] border border-line bg-white p-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1.5 block text-[13px] font-medium text-ink">{t('liveCourse')}</span>
          <select name="courseId" required className={field} defaultValue={courses[0]?.id ?? ''}>
            {courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="mb-1.5 block text-[13px] font-medium text-ink">{t('liveClassTitle')}</span>
          <input name="title" required maxLength={200} className={field} />
        </label>

        <label className="block">
          <span className="mb-1.5 block text-[13px] font-medium text-ink">{t('liveWhen')}</span>
          <input type="datetime-local" name="scheduledAt" className={field} />
        </label>

        <label className="block">
          <span className="mb-1.5 block text-[13px] font-medium text-ink">{t('liveCapacity')}</span>
          <input type="number" name="maxParticipants" min={2} max={500} defaultValue={50} className={field} />
        </label>
      </div>

      <div className="flex items-center gap-3">
        <Button type="submit" size="sm">
          {t('liveCreate')}
        </Button>
        {state.error && (
          <span role="alert" className="text-[12px] text-red-600">
            {t(`errors.${state.error}` as 'errors.saveFailed')}
          </span>
        )}
      </div>
    </form>
  );
}
