'use client';

import { useActionState, useRef, useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import Image from 'next/image';
import { ImageOff, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { uploadCourseCover, removeCourseCover } from '@/app/actions/media';
import { downscaleImage } from '@/lib/media/downscale';
import { MAX_IMAGE_BYTES } from '@/lib/media/image';
import type { AdminState } from '@/app/actions/admin';

const EMPTY: AdminState = { ok: true };

/**
 * Upload or replace a course cover.
 *
 * The picked file is RE-ENCODED here before it is sent. That is not an
 * optimisation, it is what makes the feature work at all: a Server Action body
 * is capped at 1 MB, so every photo off a phone used to fail before reaching
 * the server, and the failure named no size. Re-encoding also turns an iPhone's
 * HEIC into a JPEG, which the byte sniffer can actually accept.
 *
 * The server still validates the bytes it receives and still decides. Nothing
 * here is trusted — this only changes what gets sent.
 *
 * `next/image` on the preview, because the uploaded file can be large and the
 * editor only needs a thumbnail of it.
 */
export function CoverUpload({ courseId, coverUrl }: { courseId: string; coverUrl: string | null }) {
  const t = useTranslations('admin');
  const [state, action, pending] = useActionState(uploadCourseCover, EMPTY);
  const [, removeAction] = useActionState(removeCourseCover, EMPTY);
  const inputRef = useRef<HTMLInputElement>(null);
  const [preparing, startUpload] = useTransition();
  const [tooBig, setTooBig] = useState(false);

  // The action is called with a FormData we build, rather than by submitting
  // the form, because the file has to be shrunk first and that is async.
  async function send(file: File) {
    setTooBig(false);
    const prepared = await downscaleImage(file);
    if (prepared.size > MAX_IMAGE_BYTES) {
      // Only reachable when the canvas path failed and the original is huge.
      // Said here rather than after a round trip that the body cap would have
      // refused anyway, without naming a reason.
      setTooBig(true);
      return;
    }
    const data = new FormData();
    data.set('courseId', courseId);
    data.set('file', prepared);
    startUpload(() => action(data));
  }

  return (
    <div className="rounded-[var(--radius-card)] border border-line bg-white p-4">
      <p className="text-[13px] font-medium text-ink">{t('coverImage')}</p>

      <div className="mt-3 flex items-center gap-4">
        <div className="relative aspect-[3/2] w-28 shrink-0 overflow-hidden rounded-[var(--radius-input)] border border-line bg-surface">
          {coverUrl ? (
            <Image src={coverUrl} alt="" fill sizes="112px" className="object-cover" />
          ) : (
            <span
              className="flex size-full items-center justify-center text-ink-muted/50"
              aria-hidden="true"
            >
              <ImageOff className="size-5" />
            </span>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div>
            <input
              ref={inputRef}
              type="file"
              name="file"
              // HEIC is offered deliberately: an iPhone hands one over for any
              // photo taken with the camera, and it is re-encoded above.
              accept="image/png,image/jpeg,image/webp,image/heic,image/heif"
              onChange={(event) => {
                const file = event.currentTarget.files?.[0];
                event.currentTarget.value = '';
                if (file) void send(file);
              }}
              className="sr-only"
            />
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={pending || preparing}
              onClick={() => inputRef.current?.click()}
            >
              <Upload className="size-3.5" aria-hidden="true" />
              {pending || preparing
                ? t('coverUploading')
                : coverUrl
                  ? t('coverReplace')
                  : t('coverUpload')}
            </Button>
          </div>

          {coverUrl && (
            <form action={removeAction} className="mt-2">
              <input type="hidden" name="courseId" value={courseId} />
              <Button type="submit" size="sm" variant="ghost">
                {t('coverRemove')}
              </Button>
            </form>
          )}

          <p className="mt-2 text-[11px] leading-relaxed text-ink-muted">{t('coverHint')}</p>
          {(state.error || tooBig) && (
            <p role="alert" className="mt-1 text-[11px] text-red-600">
              {tooBig ? t('errors.tooLarge') : t(`errors.${state.error}` as 'errors.saveFailed')}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
