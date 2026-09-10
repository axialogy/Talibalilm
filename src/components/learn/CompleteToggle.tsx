'use client';

import { useActionState } from 'react';
import { useTranslations } from 'next-intl';
import { CheckCircle2, Circle } from 'lucide-react';
import { setLessonComplete, type ProgressState } from '@/app/actions/progress';
import { cn } from '@/lib/utils';

const EMPTY: ProgressState = { ok: false };

/**
 * Mark-complete toggle.
 *
 * A form posting to a server action rather than a fetch, so it works before
 * hydration and the write goes through RLS like every other one.
 */
export function CompleteToggle({ lessonId, completed }: { lessonId: string; completed: boolean }) {
  const t = useTranslations('learn');
  const [state, action, pending] = useActionState(setLessonComplete, EMPTY);

  return (
    <form action={action} className="flex flex-wrap items-center gap-3">
      <input type="hidden" name="lessonId" value={lessonId} />
      <input type="hidden" name="completed" value={completed ? 'false' : 'true'} />

      <button
        type="submit"
        disabled={pending}
        aria-pressed={completed}
        className={cn(
          'inline-flex items-center gap-2 rounded-full border px-5 py-2.5 text-[12px] font-semibold tracking-[0.08em] uppercase transition-colors disabled:opacity-60',
          completed
            ? 'border-brand-500 bg-brand-50 text-brand-700'
            : 'border-line text-ink-muted hover:border-brand-300 hover:text-brand-600',
        )}
      >
        {completed ? (
          <CheckCircle2 className="size-4" aria-hidden="true" />
        ) : (
          <Circle className="size-4" aria-hidden="true" />
        )}
        {completed ? t('completed') : t('markComplete')}
      </button>

      {state.error && (
        <span role="alert" className="text-[11px] text-red-600">
          {t('progressFailed')}
        </span>
      )}
    </form>
  );
}
