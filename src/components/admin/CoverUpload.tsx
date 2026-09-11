'use client';

import { useActionState, useRef } from 'react';
import { useTranslations } from 'next-intl';
import Image from 'next/image';
import { ImageOff, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { uploadCourseCover, removeCourseCover } from '@/app/actions/media';
import type { AdminState } from '@/app/actions/admin';

const EMPTY: AdminState = { ok: true };

/**
 * Upload or replace a course cover.
 *
 * The form submits the file straight to the server action, which validates it
 * by its bytes and stores it — the browser does no trusting of its own. When a
 * cover exists it is previewed; otherwise the drawn placeholder is what the
 * public sees, so there is nothing to show here but the picker.
 *
 * `next/image` on the preview, because the uploaded file can be large and the
 * editor only needs a thumbnail of it.
 */
export function CoverUpload({ courseId, coverUrl }: { courseId: string; coverUrl: string | null }) {
  const t = useTranslations('admin');
  const [state, action, pending] = useActionState(uploadCourseCover, EMPTY);
  const [, removeAction] = useActionState(removeCourseCover, EMPTY);
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="rounded-[var(--radius-card)] border border-line bg-white p-4">
      <p className="text-[13px] font-medium text-ink">{t('coverImage')}</p>

      <div className="mt-3 flex items-center gap-4">
        <div className="relative aspect-[3/2] w-28 shrink-0 overflow-hidden rounded-[var(--radius-input)] border border-line bg-surface">
          {coverUrl ? (
            <Image src={coverUrl} alt="" fill sizes="112px" className="object-cover" />
          ) : (
            <span className="flex size-full items-center justify-center text-ink-muted/50" aria-hidden="true">
              <ImageOff className="size-5" />
            </span>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <form action={action}>
            <input type="hidden" name="courseId" value={courseId} />
            <input
              ref={inputRef}
              type="file"
              name="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={(event) => {
                if (event.currentTarget.files?.length) event.currentTarget.form?.requestSubmit();
              }}
              className="sr-only"
            />
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={pending}
              onClick={() => inputRef.current?.click()}
            >
              <Upload className="size-3.5" aria-hidden="true" />
              {pending ? t('coverUploading') : coverUrl ? t('coverReplace') : t('coverUpload')}
            </Button>
          </form>

          {coverUrl && (
            <form action={removeAction} className="mt-2">
              <input type="hidden" name="courseId" value={courseId} />
              <Button type="submit" size="sm" variant="ghost">
                {t('coverRemove')}
              </Button>
            </form>
          )}

          <p className="mt-2 text-[11px] leading-relaxed text-ink-muted">{t('coverHint')}</p>
          {state.error && (
            <p role="alert" className="mt-1 text-[11px] text-red-600">
              {t(`errors.${state.error}` as 'errors.saveFailed')}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
