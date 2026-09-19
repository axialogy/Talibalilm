'use client';

import { useActionState, useRef, useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import Image from 'next/image';
import { ImageOff, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ActionError } from '@/components/admin/ActionError';
import { removeCursusImage, uploadCursusImage } from '@/app/actions/catalog';
import { downscaleImage } from '@/lib/media/downscale';
import { MAX_IMAGE_BYTES } from '@/lib/media/image';
import type { AdminState } from '@/app/actions/admin';

const EMPTY: AdminState = { ok: true };

/**
 * The programme poster for one cursus.
 *
 * Same shape as the course cover uploader: the picked file is re-encoded in
 * the browser, the server checks the bytes before storing anything, and the
 * preview is whatever the row currently holds.
 */
export function CursusImageUpload({
  cursusId,
  imageUrl,
}: {
  cursusId: string;
  imageUrl: string | null;
}) {
  const t = useTranslations('admin');
  const [state, action] = useActionState(uploadCursusImage, EMPTY);
  const [, removeAction] = useActionState(removeCursusImage, EMPTY);
  const inputRef = useRef<HTMLInputElement>(null);
  const [preparing, startUpload] = useTransition();
  const [tooBig, setTooBig] = useState(false);

  async function send(file: File) {
    setTooBig(false);
    const prepared = await downscaleImage(file);
    if (prepared.size > MAX_IMAGE_BYTES) {
      setTooBig(true);
      return;
    }
    const data = new FormData();
    data.set('id', cursusId);
    data.set('file', prepared);
    startUpload(() => action(data));
  }

  return (
    <div className="rounded-[var(--radius-card)] border border-line bg-surface/40 p-4">
      <p className="text-[13px] font-medium text-ink">{t('cursusImage')}</p>
      <p className="mt-1 text-[11px] leading-relaxed text-ink-muted">{t('cursusImageHint')}</p>

      <div className="mt-3 flex items-center gap-4">
        <div className="relative aspect-[3/4] w-24 shrink-0 overflow-hidden rounded-[var(--radius-input)] border border-line bg-white">
          {imageUrl ? (
            <Image src={imageUrl} alt="" fill sizes="96px" className="object-cover" />
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
          <input
            ref={inputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="sr-only"
            onChange={(event) => {
              const file = event.currentTarget.files?.[0];
              event.currentTarget.value = '';
              if (file) void send(file);
            }}
          />
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={preparing}
            onClick={() => inputRef.current?.click()}
          >
            <Upload className="size-3.5" aria-hidden="true" />
            {preparing
              ? t('coverUploading')
              : imageUrl
                ? t('coverReplace')
                : t('coverUpload')}
          </Button>

          {imageUrl && (
            <form action={removeAction} className="mt-2">
              <input type="hidden" name="id" value={cursusId} />
              <Button type="submit" size="sm" variant="ghost">
                {t('coverRemove')}
              </Button>
            </form>
          )}

          {(state.error || tooBig) && (
            <ActionError
              state={tooBig ? { ok: false, error: 'tooLarge' } : state}
            />
          )}
        </div>
      </div>
    </div>
  );
}
