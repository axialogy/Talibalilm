'use client';

import { useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { ChevronLeft, ChevronRight, Loader2, PresentationIcon, Upload } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSlideUpload } from './useSlideUpload';

/**
 * The deck, during the lesson.
 *
 * The teacher moves; everyone else follows, because the slide index travels as
 * a host-only message and each student's browser refuses one from anywhere
 * else. The images themselves were signed for each viewer by the server after
 * the database confirmed they hold the module, so a student who is not in the
 * class has nothing to render even if they learn the URL.
 */
export function SlidesPanel({
  sessionId,
  slides,
  current,
  canPresent,
  onGo,
}: {
  sessionId: string;
  slides: { id: string; url: string | null; filename: string }[];
  current: number;
  canPresent: boolean;
  onGo: (index: number) => void;
}) {
  const t = useTranslations('live');
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [dragging, setDragging] = useState(false);
  const { busy, converting, error, upload } = useSlideUpload(sessionId, () =>
    window.location.reload(),
  );

  const choose = (files: FileList | File[]) => {
    void upload(files).then(() => {
      if (inputRef.current) inputRef.current.value = '';
    });
  };

  const uploader = canPresent ? (
    <label
      onDragOver={(event) => {
        event.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(event) => {
        event.preventDefault();
        setDragging(false);
        if (event.dataTransfer.files?.length) choose(event.dataTransfer.files);
      }}
      className={cn(
        'm-2 flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed p-5 text-center transition-colors',
        dragging
          ? 'border-brand-400 bg-brand-500/10'
          : 'border-white/20 hover:border-brand-400/70 hover:bg-white/5',
      )}
    >
      {busy > 0 ? (
        <Loader2 className="size-5 animate-spin text-white/60" aria-hidden="true" />
      ) : (
        <Upload className="size-5 text-white/50" aria-hidden="true" />
      )}
      <span className="text-[13px] font-medium text-white">
        {converting
          ? t('slidesConverting', { page: converting.page, pages: converting.pages })
          : busy > 0
            ? t('slidesUploading', { count: busy })
            : t('slidesAdd')}
      </span>
      <span className="text-[11px] leading-relaxed text-white/40">{t('slidesHint')}</span>
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,application/pdf"
        multiple
        className="sr-only"
        onChange={(event) => {
          if (event.target.files?.length) choose(event.target.files);
        }}
      />
    </label>
  ) : null;

  if (slides.length === 0) {
    return (
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-2 p-6 text-center">
        <PresentationIcon className="size-5 text-white/30" aria-hidden="true" />
        <p className="text-[12px] text-white/40">
          {canPresent ? t('slidesNoneHost') : t('slidesNone')}
        </p>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {uploader}
      {error && (
        <p role="alert" className="px-3 pb-1.5 text-center text-[11px] text-red-300">
          {t(`errors.${error}` as 'errors.uploadFailed')}
        </p>
      )}
      {canPresent && (
        <div className="flex items-center gap-2 border-b border-white/10 p-2">
          <button
            type="button"
            onClick={() => onGo(Math.max(0, current - 1))}
            disabled={current <= 0}
            className="inline-flex size-8 items-center justify-center rounded-lg text-white/70 hover:bg-white/10 disabled:opacity-30"
          >
            <ChevronLeft className="size-4" aria-hidden="true" />
            <span className="sr-only">{t('slidePrev')}</span>
          </button>
          <p className="flex-1 text-center text-[12px] text-white/60">
            {current + 1} / {slides.length}
          </p>
          <button
            type="button"
            onClick={() => onGo(Math.min(slides.length - 1, current + 1))}
            disabled={current >= slides.length - 1}
            className="inline-flex size-8 items-center justify-center rounded-lg text-white/70 hover:bg-white/10 disabled:opacity-30"
          >
            <ChevronRight className="size-4" aria-hidden="true" />
            <span className="sr-only">{t('slideNext')}</span>
          </button>
        </div>
      )}

      <ol className="min-h-0 flex-1 space-y-2 overflow-y-auto p-2">
        {slides.map((slide, index) => (
          <li key={slide.id}>
            <button
              type="button"
              onClick={() => canPresent && onGo(index)}
              disabled={!canPresent}
              className={cn(
                'block w-full overflow-hidden rounded-lg ring-2 transition-colors',
                index === current ? 'ring-brand-400' : 'ring-transparent hover:ring-white/20',
                !canPresent && 'cursor-default',
              )}
            >
              <span className="relative block aspect-video bg-ink">
                {slide.url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={slide.url}
                    alt={slide.filename}
                    loading="lazy"
                    className="absolute inset-0 size-full object-contain"
                  />
                )}
                <span className="absolute start-1.5 top-1.5 rounded bg-black/70 px-1.5 text-[10px] text-white">
                  {index + 1}
                </span>
              </span>
            </button>
          </li>
        ))}
      </ol>
    </div>
  );
}
