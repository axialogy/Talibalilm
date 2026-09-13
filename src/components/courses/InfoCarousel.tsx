'use client';

import { useState } from 'react';
import Image from 'next/image';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { GalleryImage } from '@/lib/content/presentation';

/**
 * The Informations carousel.
 *
 * Every photograph is in the markup and the inactive ones are hidden, so the
 * whole thing is readable without JavaScript and with a screen reader — which
 * is why it is a plain list with `aria-hidden` rather than a transform on a
 * track. Only the first image is eager; the rest load as they come round.
 */
export function InfoCarousel({
  images,
  labels,
}: {
  images: GalleryImage[];
  labels: { previous: string; next: string; goTo: string };
}) {
  const [index, setIndex] = useState(0);
  if (images.length === 0) return null;

  const total = images.length;
  const move = (delta: number) => setIndex((current) => (current + delta + total) % total);

  return (
    <div className="relative">
      <ul className="relative aspect-[16/9] overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface">
        {images.map((image, i) => (
          <li
            key={image.url}
            aria-hidden={i !== index}
            className={cn(
              'absolute inset-0 transition-opacity duration-500',
              i === index ? 'opacity-100' : 'pointer-events-none opacity-0',
            )}
          >
            <Image
              src={image.url}
              alt={image.alt}
              fill
              priority={i === 0}
              sizes="(min-width: 1024px) 900px, 100vw"
              className="object-cover"
            />
          </li>
        ))}
      </ul>

      {total > 1 && (
        <>
          <button
            type="button"
            onClick={() => move(-1)}
            aria-label={labels.previous}
            className="absolute start-3 top-1/2 flex size-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-ink shadow-card transition-colors hover:bg-gold-500 hover:text-white"
          >
            <ChevronLeft className="size-5" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => move(1)}
            aria-label={labels.next}
            className="absolute end-3 top-1/2 flex size-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-ink shadow-card transition-colors hover:bg-gold-500 hover:text-white"
          >
            <ChevronRight className="size-5" aria-hidden="true" />
          </button>

          <div className="mt-4 flex items-center justify-center gap-2">
            {images.map((image, i) => (
              <button
                key={image.url}
                type="button"
                onClick={() => setIndex(i)}
                aria-label={`${labels.goTo} ${i + 1}`}
                aria-current={i === index}
                className={cn(
                  'size-2.5 rounded-full transition-colors',
                  i === index ? 'bg-gold-500' : 'bg-line hover:bg-gold-300',
                )}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
