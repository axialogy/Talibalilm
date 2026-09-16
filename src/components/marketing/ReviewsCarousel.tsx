'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { ChevronLeft, ChevronRight, Quote, Star } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface ReviewCard {
  id: string;
  authorName: string;
  authorContext: string;
  quote: string;
  rating: number;
  avatarUrl: string | null;
}

/** Beyond this, the quote is clamped until the reader asks for the rest. */
const LONG_QUOTE = 200;

/**
 * What students say, as a carousel.
 *
 * A horizontally scrollable track with snap points, so it swipes natively on a
 * phone and the arrows are only an affordance on a pointer device. The cards
 * are flex children with `items-stretch`, which is what keeps them all the
 * same height whatever their text; a long quote is clamped behind "Lire la
 * suite" rather than stretching the row.
 */
export function ReviewsCarousel({
  reviews,
  labels,
}: {
  reviews: ReviewCard[];
  labels: { readMore: string; readLess: string; previous: string; next: string };
}) {
  const trackRef = useRef<HTMLUListElement>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(false);

  const updateEdges = useCallback(() => {
    const track = trackRef.current;
    if (!track) return;
    setAtStart(track.scrollLeft <= 4);
    setAtEnd(track.scrollLeft + track.clientWidth >= track.scrollWidth - 4);
  }, []);

  useEffect(() => {
    updateEdges();
    const track = trackRef.current;
    if (!track) return;
    track.addEventListener('scroll', updateEdges, { passive: true });
    window.addEventListener('resize', updateEdges);
    return () => {
      track.removeEventListener('scroll', updateEdges);
      window.removeEventListener('resize', updateEdges);
    };
  }, [updateEdges]);

  const scrollByCard = (direction: 1 | -1) => {
    const track = trackRef.current;
    if (!track) return;
    const card = track.querySelector('li');
    const step = card ? card.getBoundingClientRect().width + 24 : track.clientWidth * 0.8;
    track.scrollBy({ left: direction * step, behavior: 'smooth' });
  };

  const toggle = (id: string) => {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="relative">
      <ul
        ref={trackRef}
        className="flex snap-x snap-mandatory items-stretch gap-6 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {reviews.map((review) => {
          const isLong = review.quote.length > LONG_QUOTE;
          const isOpen = expanded.has(review.id);
          return (
            <li
              key={review.id}
              className="flex w-[86%] shrink-0 snap-start flex-col rounded-[var(--radius-card)] border border-line bg-white p-6 shadow-card sm:w-[calc((100%-1.5rem)/2)] lg:w-[calc((100%-3rem)/3)]"
            >
              <Quote className="size-6 shrink-0 text-gold-400" aria-hidden="true" />

              <blockquote
                className={cn(
                  'mt-4 flex-1 text-[14px] leading-relaxed text-ink-muted',
                  isLong && !isOpen && 'line-clamp-5',
                )}
              >
                {review.quote}
              </blockquote>

              {isLong && (
                <button
                  type="button"
                  onClick={() => toggle(review.id)}
                  aria-expanded={isOpen}
                  className="mt-2 self-start text-[12px] font-semibold text-brand-600 transition-colors hover:text-brand-700"
                >
                  {isOpen ? labels.readLess : labels.readMore}
                </button>
              )}

              <div className="mt-5 flex items-center gap-3 border-t border-line pt-4">
                {review.avatarUrl ? (
                  <span className="relative size-10 shrink-0 overflow-hidden rounded-full bg-surface">
                    <Image
                      src={review.avatarUrl}
                      alt=""
                      fill
                      sizes="40px"
                      className="object-cover"
                    />
                  </span>
                ) : (
                  <span
                    className="flex size-10 shrink-0 items-center justify-center rounded-full bg-brand-500 font-display text-[15px] font-semibold text-white"
                    aria-hidden="true"
                  >
                    {review.authorName.charAt(0).toUpperCase()}
                  </span>
                )}

                <div className="min-w-0 flex-1">
                  <p className="font-display text-[14px] font-semibold text-ink">
                    {review.authorName}
                  </p>
                  {review.authorContext && (
                    <p className="text-[11px] text-ink-muted">{review.authorContext}</p>
                  )}
                </div>

                <p className="flex shrink-0 items-center gap-0.5">
                  {/* The icons say nothing to a screen reader; the number does. */}
                  <span className="sr-only">{review.rating} / 5</span>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <Star
                      key={n}
                      aria-hidden="true"
                      className={cn(
                        'size-3.5',
                        n <= review.rating ? 'fill-gold-500 text-gold-500' : 'text-line',
                      )}
                    />
                  ))}
                </p>
              </div>
            </li>
          );
        })}
      </ul>

      {reviews.length > 1 && (
        <div className="mt-6 flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => scrollByCard(-1)}
            disabled={atStart}
            aria-label={labels.previous}
            className="flex size-10 items-center justify-center rounded-full border border-line bg-white text-ink transition-colors hover:border-brand-300 hover:text-brand-600 disabled:pointer-events-none disabled:opacity-40"
          >
            <ChevronLeft className="size-5" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => scrollByCard(1)}
            disabled={atEnd}
            aria-label={labels.next}
            className="flex size-10 items-center justify-center rounded-full border border-line bg-white text-ink transition-colors hover:border-brand-300 hover:text-brand-600 disabled:pointer-events-none disabled:opacity-40"
          >
            <ChevronRight className="size-5" aria-hidden="true" />
          </button>
        </div>
      )}
    </div>
  );
}
