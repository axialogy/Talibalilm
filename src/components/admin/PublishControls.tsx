'use client';

import { useActionState } from 'react';
import { useTranslations } from 'next-intl';
import { Eye, Globe, Trash2 } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { deleteCourse, setCourseStatus, type AdminState } from '@/app/actions/admin';

const EMPTY: AdminState = { ok: true };

export function PublishControls({
  courseId,
  status,
  slug,
}: {
  courseId: string;
  status: 'draft' | 'published' | 'archived';
  slug: string;
}) {
  const t = useTranslations('admin');
  const [, statusAction, statusPending] = useActionState(setCourseStatus, EMPTY);
  const [, deleteAction] = useActionState(deleteCourse, EMPTY);
  const published = status === 'published';

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Badge variant={published ? 'brand' : 'muted'}>{t(status)}</Badge>

      {published && (
        <Button asChild variant="ghost" size="sm">
          <Link href={`/courses/${slug}`}>
            <Eye className="size-3.5" aria-hidden="true" />
            {t('published')}
          </Link>
        </Button>
      )}

      <form action={statusAction}>
        <input type="hidden" name="id" value={courseId} />
        <input type="hidden" name="status" value={published ? 'draft' : 'published'} />
        <Button type="submit" size="sm" variant={published ? 'subtle' : 'primary'} disabled={statusPending}>
          <Globe className="size-3.5" aria-hidden="true" />
          {published ? t('unpublish') : t('publish')}
        </Button>
      </form>

      <form
        action={deleteAction}
        // A destructive action with no undo. The confirm is the only thing
        // between a mistyped click and losing a course and all its lessons.
        onSubmit={(event) => {
          if (!window.confirm(t('confirmDelete'))) event.preventDefault();
        }}
      >
        <input type="hidden" name="id" value={courseId} />
        <Button type="submit" size="sm" variant="ghost" aria-label={t('delete')}>
          <Trash2 className="size-3.5" aria-hidden="true" />
        </Button>
      </form>
    </div>
  );
}
