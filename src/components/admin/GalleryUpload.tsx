'use client';

import { useActionState, useRef } from 'react';
import { useTranslations } from 'next-intl';
import Image from 'next/image';
import { Upload, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { addGalleryImage, removeGalleryImage } from '@/app/actions/media';
import type { AdminState } from '@/app/actions/admin';
import type { GalleryImage } from '@/lib/content/presentation';

const EMPTY: AdminState = { ok: true };

/**
 * The photographs shown in the module's Informations carousel.
 *
 * Same shape as the cover uploader: picking a file submits immediately, the
 * server checks the bytes before storing anything, and the list below is
 * whatever the column currently holds rather than anything this component
 * remembers.
 */
export function GalleryUpload({ courseId, images }: { courseId: string; images: GalleryImage[] }) {
  const t = useTranslations('admin');
  const [state, action, pending] = useActionState(addGalleryImage, EMPTY);
  const [, removeAction] = useActionState(removeGalleryImage, EMPTY);
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="rounded-[var(--radius-card)] border border-line bg-white p-4">
      <p className="text-[13px] font-medium text-ink">{t('gallery')}</p>
      <p className="mt-1 text-[11px] leading-relaxed text-ink-muted">{t('galleryHint')}</p>

      {images.length > 0 && (
        <ul className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
          {images.map((image) => (
            <li key={image.url} className="group relative">
              <div className="relative aspect-[3/2] overflow-hidden rounded-[var(--radius-input)] border border-line bg-surface">
                <Image
                  src={image.url}
                  alt={image.alt}
                  fill
                  sizes="160px"
                  className="object-cover"
                />
              </div>
              <form action={removeAction}>
                <input type="hidden" name="courseId" value={courseId} />
                <input type="hidden" name="url" value={image.url} />
                <button
                  type="submit"
                  aria-label={t('galleryRemove')}
                  className="absolute -top-2 -end-2 flex size-6 items-center justify-center rounded-full border border-line bg-white text-ink-muted shadow-sm transition-colors hover:bg-red-600 hover:text-white"
                >
                  <X className="size-3.5" aria-hidden="true" />
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}

      <form action={action} className="mt-3">
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
          {pending ? t('coverUploading') : t('galleryAdd')}
        </Button>
      </form>

      {state.error && (
        <p role="alert" className="mt-2 text-[11px] text-red-600">
          {t(`errors.${state.error}` as 'errors.saveFailed')}
        </p>
      )}
    </div>
  );
}
