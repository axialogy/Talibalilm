'use client';

import { useActionState } from 'react';
import { useTranslations } from 'next-intl';
import { Archive, Pencil, Trash2, Undo2 } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { archiveCourse, deleteCourse } from '@/app/actions/catalog';
import type { AdminState } from '@/app/actions/admin';

const EMPTY: AdminState = { ok: true };

/**
 * Edit, archive, delete — on the row, where the teacher is looking.
 *
 * Archive is offered first and delete last, deliberately. Deleting a course
 * takes its prices with it and, where the database allows it at all, the record
 * of what students were entitled to; archiving removes it from the catalogue
 * and touches no sale. Delete is refused outright for a course with any
 * history, and the message says which kind.
 */
export function CourseRowActions({
  courseId,
  status,
}: {
  courseId: string;
  status: 'draft' | 'published' | 'archived';
}) {
  const t = useTranslations('admin');
  const [, archive] = useActionState(archiveCourse, EMPTY);
  const [removeState, remove] = useActionState(deleteCourse, EMPTY);

  const iconButton =
    'inline-flex size-8 items-center justify-center rounded-lg text-ink-muted transition-colors hover:bg-brand-50 hover:text-brand-600';

  return (
    <div className="flex flex-wrap items-center justify-end gap-1">
      <Link href={`/admin/courses/${courseId}`} className={iconButton} title={t('courseEdit')}>
        <Pencil className="size-4" aria-hidden="true" />
        <span className="sr-only">{t('courseEdit')}</span>
      </Link>

      <form action={archive}>
        <input type="hidden" name="id" value={courseId} />
        <input type="hidden" name="status" value={status === 'archived' ? 'draft' : 'archived'} />
        <button
          type="submit"
          className={iconButton}
          title={status === 'archived' ? t('courseUnarchive') : t('courseArchive')}
        >
          {status === 'archived' ? (
            <Undo2 className="size-4" aria-hidden="true" />
          ) : (
            <Archive className="size-4" aria-hidden="true" />
          )}
          <span className="sr-only">
            {status === 'archived' ? t('courseUnarchive') : t('courseArchive')}
          </span>
        </button>
      </form>

      <form
        action={remove}
        onSubmit={(event) => {
          if (!window.confirm(t('courseDeleteConfirm'))) event.preventDefault();
        }}
      >
        <input type="hidden" name="id" value={courseId} />
        <button
          type="submit"
          className={`${iconButton} hover:bg-red-50 hover:text-red-600`}
          title={t('courseDelete')}
        >
          <Trash2 className="size-4" aria-hidden="true" />
          <span className="sr-only">{t('courseDelete')}</span>
        </button>
      </form>

      {removeState.error && (
        <p role="alert" className="w-full text-end text-[11px] text-red-600">
          {t(`errors.${removeState.error}` as 'errors.saveFailed')}
        </p>
      )}
    </div>
  );
}
