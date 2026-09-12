'use client';

import { useActionState, useState } from 'react';
import { useTranslations } from 'next-intl';
import { ChevronDown, ChevronUp, GripVertical, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Field } from '@/components/ui/field';
import {
  addLesson,
  addModule,
  deleteLesson,
  deleteModule,
  moveLesson,
  moveModule,
  renameModule,
  updateLesson,
  type AdminState,
} from '@/app/actions/admin';
import { cn } from '@/lib/utils';

const EMPTY: AdminState = { ok: true };

export interface OutlineLesson {
  id: string;
  title: string;
  type: string;
  position: number;
  minutes: number;
  isPreview: boolean;
  content: string;
  videoId: string;
}

export interface OutlineModule {
  id: string;
  title: string;
  position: number;
  lessons: OutlineLesson[];
}

/**
 * Modules and lessons, with reordering.
 *
 * Reordering is up/down buttons rather than drag-and-drop. That is a
 * deliberate trade: buttons are keyboard-operable and screen-reader-legible
 * for free, they work on touch without a long-press gesture, and each press is
 * one swap the database can validate. Drag-and-drop is the nicer gesture for a
 * sighted mouse user and is worth adding on top — but not instead.
 */
export function CourseOutline({
  courseId,
  modules,
}: {
  courseId: string;
  modules: OutlineModule[];
}) {
  const t = useTranslations('admin');
  const [, addModuleAction] = useActionState(addModule, EMPTY);

  return (
    <div>
      <ol className="space-y-4">
        {modules.map((module, index) => (
          <ModuleCard
            key={module.id}
            module={module}
            previous={index > 0 ? modules[index - 1] : undefined}
            next={index < modules.length - 1 ? modules[index + 1] : undefined}
          />
        ))}
      </ol>

      <form
        action={addModuleAction}
        className="mt-4 flex flex-wrap items-end gap-3 rounded-[var(--radius-card)] border border-dashed border-line bg-surface/40 p-4"
      >
        <input type="hidden" name="courseId" value={courseId} />
        <Field label={t('moduleTitle')} name="title" required className="min-w-[220px] flex-1" />
        <Button type="submit" variant="outline" size="md">
          <Plus className="size-4" aria-hidden="true" />
          {t('addModule')}
        </Button>
      </form>
    </div>
  );
}

function ModuleCard({
  module,
  previous,
  next,
}: {
  module: OutlineModule;
  previous: OutlineModule | undefined;
  next: OutlineModule | undefined;
}) {
  const t = useTranslations('admin');
  const [, renameAction] = useActionState(renameModule, EMPTY);
  const [, deleteAction] = useActionState(deleteModule, EMPTY);
  const [, moveAction] = useActionState(moveModule, EMPTY);
  const [, addLessonAction] = useActionState(addLesson, EMPTY);

  return (
    <li className="rounded-[var(--radius-card)] border border-line bg-white">
      <div className="flex flex-wrap items-center gap-2 border-b border-line p-4">
        <GripVertical className="size-4 shrink-0 text-ink-muted/40" aria-hidden="true" />

        <form action={renameAction} className="flex min-w-[200px] flex-1 items-center gap-2">
          <input type="hidden" name="id" value={module.id} />
          <input
            name="title"
            defaultValue={module.title}
            aria-label={t('moduleTitle')}
            className="min-w-0 flex-1 rounded-[var(--radius-input)] border border-transparent bg-transparent px-2 py-1.5 font-display text-[15px] font-semibold text-ink transition-colors hover:border-line focus:border-brand-400 focus:outline-none"
          />
          <Button type="submit" size="sm" variant="ghost">
            {t('save')}
          </Button>
        </form>

        <MoveButtons formAction={moveAction} item={module} previous={previous} next={next} />

        <form
          action={deleteAction}
          onSubmit={(event) => {
            if (!window.confirm(t('confirmDelete'))) event.preventDefault();
          }}
        >
          <input type="hidden" name="id" value={module.id} />
          <Button type="submit" size="sm" variant="ghost" aria-label={t('delete')}>
            <Trash2 className="size-3.5" aria-hidden="true" />
          </Button>
        </form>
      </div>

      <ul className="divide-y divide-line">
        {module.lessons.map((lesson, index) => (
          <LessonRow
            key={lesson.id}
            lesson={lesson}
            previous={index > 0 ? module.lessons[index - 1] : undefined}
            next={index < module.lessons.length - 1 ? module.lessons[index + 1] : undefined}
          />
        ))}
      </ul>

      <form action={addLessonAction} className="flex flex-wrap items-end gap-3 p-4">
        <input type="hidden" name="moduleId" value={module.id} />
        <Field label={t('lessonTitle')} name="title" required className="min-w-[200px] flex-1" />
        <Button type="submit" size="sm" variant="outline">
          <Plus className="size-3.5" aria-hidden="true" />
          {t('addLesson')}
        </Button>
      </form>
    </li>
  );
}

function LessonRow({
  lesson,
  previous,
  next,
}: {
  lesson: OutlineLesson;
  previous: OutlineLesson | undefined;
  next: OutlineLesson | undefined;
}) {
  const t = useTranslations('admin');
  const [open, setOpen] = useState(false);
  const [state, updateAction] = useActionState(updateLesson, EMPTY);
  const [, deleteAction] = useActionState(deleteLesson, EMPTY);
  const [, moveAction] = useActionState(moveLesson, EMPTY);

  return (
    <li className="p-4">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className="min-w-0 flex-1 text-start text-[13px] text-ink transition-colors hover:text-brand-600"
        >
          <span className="line-clamp-1">{lesson.title}</span>
          <span className="text-[11px] text-ink-muted">
            {lesson.type} · {lesson.minutes} min
          </span>
        </button>

        {lesson.isPreview && <Badge variant="gold">{t('isPreview')}</Badge>}

        <MoveButtons formAction={moveAction} item={lesson} previous={previous} next={next} />

        <form
          action={deleteAction}
          onSubmit={(event) => {
            if (!window.confirm(t('confirmDelete'))) event.preventDefault();
          }}
        >
          <input type="hidden" name="id" value={lesson.id} />
          <Button type="submit" size="sm" variant="ghost" aria-label={t('delete')}>
            <Trash2 className="size-3.5" aria-hidden="true" />
          </Button>
        </form>
      </div>

      {open && (
        <form action={updateAction} className="mt-4 space-y-3 rounded-[var(--radius-input)] bg-surface/50 p-4">
          <input type="hidden" name="id" value={lesson.id} />

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={t('lessonTitle')} name="title" defaultValue={lesson.title} required />
            <label className="block">
              <span className="mb-1.5 block text-[13px] font-medium text-ink">{t('lessonType')}</span>
              <select
                name="type"
                defaultValue={lesson.type}
                className="w-full rounded-[var(--radius-input)] border border-line bg-white px-3 py-2.5 text-sm text-ink outline-none focus:border-brand-400"
              >
                {['video', 'text', 'live', 'quiz', 'assignment'].map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </label>
            <Field
              label={t('duration')}
              name="minutes"
              type="number"
              min={0}
              defaultValue={lesson.minutes}
            />
            <Field
              label={t('videoId')}
              name="video_id"
              defaultValue={lesson.videoId}
              hint={t('videoIdHint')}
              error={
                state.error === 'video_unrecognised' || state.error === 'video_id_is_url'
                  ? t('videoUnrecognised')
                  : undefined
              }
            />
          </div>

          <label className="block">
            <span className="mb-1.5 block text-[13px] font-medium text-ink">{t('content')}</span>
            <textarea
              name="content"
              rows={8}
              defaultValue={lesson.content}
              className="w-full rounded-[var(--radius-input)] border border-line bg-white px-4 py-3 text-sm text-ink outline-none focus:border-brand-400"
            />
          </label>

          <label className="flex items-center gap-2.5 text-[13px] text-ink">
            <input
              type="checkbox"
              name="is_preview"
              defaultChecked={lesson.isPreview}
              className="size-4 rounded border-line text-brand-500"
            />
            {t('isPreview')}
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
      )}
    </li>
  );
}

/** Swap this row with its neighbour. Renders nothing at the ends of a list. */
function MoveButtons<T extends { id: string; position: number }>({
  formAction,
  item,
  previous,
  next,
}: {
  formAction: (formData: FormData) => void;
  item: T;
  previous: T | undefined;
  next: T | undefined;
}) {
  const t = useTranslations('admin');

  return (
    <span className="inline-flex">
      {([['up', previous], ['down', next]] as const).map(([direction, neighbour]) => (
        <form key={direction} action={formAction}>
          <input type="hidden" name="id" value={item.id} />
          <input type="hidden" name="position" value={item.position} />
          <input type="hidden" name="otherId" value={neighbour?.id ?? ''} />
          <input type="hidden" name="otherPosition" value={neighbour?.position ?? ''} />
          <button
            type="submit"
            disabled={!neighbour}
            aria-label={direction === 'up' ? t('moveUp') : t('moveDown')}
            className={cn(
              'rounded-md p-1.5 transition-colors',
              neighbour
                ? 'text-ink-muted hover:bg-brand-50 hover:text-brand-600'
                : 'cursor-not-allowed text-ink-muted/25',
            )}
          >
            {direction === 'up' ? (
              <ChevronUp className="size-3.5" aria-hidden="true" />
            ) : (
              <ChevronDown className="size-3.5" aria-hidden="true" />
            )}
          </button>
        </form>
      ))}
    </span>
  );
}
