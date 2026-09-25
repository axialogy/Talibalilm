'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { ArrowRight, CalendarDays, MapPin, X } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { Button } from '@/components/ui/button';

/**
 * One announcement.
 *
 * The cover and the title both open the image full-size in a modal — the
 * school publishes posters, and a poster is unreadable at card width. Nothing
 * navigates away: a visitor who was reading the news keeps their place.
 *
 * The modal is a plain fixed overlay rather than a route, so the image is
 * already loaded when it opens. Escape and a click on the backdrop close it,
 * and the page underneath stops scrolling while it is up.
 */
export function EventCard({
  title,
  titleAr,
  excerpt,
  imageUrl,
  dateLabel,
  phaseLabel,
  location,
  href,
  labels,
}: {
  title: string;
  titleAr: string;
  excerpt: string;
  imageUrl: string | null;
  dateLabel: string | null;
  /** À venir, en cours or terminé — set by the office, not derived from the date. */
  phaseLabel: string;
  location: string;
  href: string;
  labels: { cta: string; imageLabel: string; imageClose: string };
}) {
  const [zoom, setZoom] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!zoom) return;

    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setZoom(false);
    };
    document.addEventListener('keydown', onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();

    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previous;
    };
  }, [zoom]);

  const open = imageUrl !== null;

  return (
    <li className="flex flex-col overflow-hidden rounded-[var(--radius-card)] border border-line bg-white shadow-card">
      <div className="relative aspect-[3/2] bg-brand-900">
        {imageUrl ? (
          <button
            type="button"
            onClick={() => setZoom(true)}
            aria-label={labels.imageLabel}
            className="block size-full cursor-zoom-in"
          >
            <Image
              src={imageUrl}
              alt={title}
              fill
              sizes="(min-width: 1024px) 380px, (min-width: 640px) 50vw, 100vw"
              className="object-cover transition-transform duration-500 hover:scale-[1.03]"
            />
          </button>
        ) : (
          <span
            className="flex size-full items-center justify-center text-gold-400"
            aria-hidden="true"
          >
            <CalendarDays className="size-10" />
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col p-5">
        {(dateLabel || phaseLabel) && (
          <p className="flex flex-wrap items-center gap-2 text-[11px] tracking-[0.08em] text-gold-600 uppercase">
            {dateLabel && (
              <span className="flex items-center gap-1.5">
                <CalendarDays className="size-3.5" aria-hidden="true" />
                {dateLabel}
              </span>
            )}
            {phaseLabel && (
              <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[10px] font-medium tracking-normal text-brand-700">
                {phaseLabel}
              </span>
            )}
          </p>
        )}

        <h3 className="mt-2 font-display text-[16px] font-semibold text-ink">
          {open ? (
            <button
              type="button"
              onClick={() => setZoom(true)}
              className="text-start transition-colors hover:text-brand-600"
            >
              {title}
            </button>
          ) : (
            title
          )}
        </h3>
        {titleAr && (
          <p lang="ar" dir="rtl" className="mt-1 font-arabic text-lg text-gold-600">
            {titleAr}
          </p>
        )}

        {excerpt && (
          <p className="mt-3 flex-1 text-[13px] leading-relaxed text-ink-muted">{excerpt}</p>
        )}

        {location && (
          <p className="mt-3 flex items-center gap-1.5 text-[12px] text-ink-muted">
            <MapPin className="size-3.5 shrink-0" aria-hidden="true" />
            {location}
          </p>
        )}

        {/*
          The link the office typed may be one of our pages or an outside form.
          An absolute URL leaves through a plain anchor; next-intl's Link would
          prefix it with a locale and produce a path that does not exist.
        */}
        {href && (
          <div className="mt-5">
            {/^https?:\/\//i.test(href) ? (
              <Button asChild size="sm" variant="gold">
                <a href={href} target="_blank" rel="noopener noreferrer">
                  {labels.cta}
                  <ArrowRight className="size-4" aria-hidden="true" />
                </a>
              </Button>
            ) : (
              <Button asChild size="sm" variant="gold">
                <Link href={href}>
                  {labels.cta}
                  <ArrowRight className="size-4" aria-hidden="true" />
                </Link>
              </Button>
            )}
          </div>
        )}
      </div>

      {zoom && imageUrl && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={title}
          onClick={() => setZoom(false)}
          className="fixed inset-0 z-70 flex items-center justify-center bg-ink/90 p-4 backdrop-blur-sm sm:p-8"
        >
          <button
            ref={closeRef}
            type="button"
            onClick={() => setZoom(false)}
            aria-label={labels.imageClose}
            className="absolute end-4 top-4 flex size-11 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
          >
            <X className="size-5" aria-hidden="true" />
          </button>

          <div
            className="relative max-h-[88vh] w-full max-w-5xl"
            onClick={(event) => event.stopPropagation()}
          >
            <Image
              src={imageUrl}
              alt={title}
              width={1600}
              height={1200}
              sizes="100vw"
              className="mx-auto h-auto max-h-[88vh] w-auto max-w-full rounded-[var(--radius-card)] object-contain shadow-lifted"
            />
          </div>
        </div>
      )}
    </li>
  );
}
