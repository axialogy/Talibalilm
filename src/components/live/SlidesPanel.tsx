'use client';

import { useTranslations } from 'next-intl';
import { ChevronLeft, ChevronRight, PresentationIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

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
  slides,
  current,
  canPresent,
  onGo,
}: {
  slides: { id: string; url: string | null; filename: string }[];
  current: number;
  canPresent: boolean;
  onGo: (index: number) => void;
}) {
  const t = useTranslations('live');

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
              <span className="relative block aspect-video bg-ink-900">
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
