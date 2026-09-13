import { getTranslations } from 'next-intl/server';
import Image from 'next/image';
import { Quote, Star } from 'lucide-react';
import type { ReviewView } from '@/lib/data/site';
import { cn } from '@/lib/utils';

/**
 * What students say.
 *
 * Like the events grid, absent rather than empty when nothing is published —
 * and nothing is seeded, because a testimonial is a sentence attributed to a
 * real person and inventing one is not a design decision that was ours to
 * make.
 *
 * The rating is drawn as five stars with the filled ones marked, and the count
 * is also written out for a screen reader: a row of icons says nothing to
 * somebody who cannot see it.
 */
export async function ReviewsSection({ reviews }: { reviews: ReviewView[] }) {
  if (reviews.length === 0) return null;

  const t = await getTranslations('home');

  return (
    <section className="bg-surface/60 py-16 sm:py-20">
      <div className="shell">
        <h2 className="text-center font-display text-[clamp(1.5rem,3.4vw,2rem)] font-semibold text-gold-600">
          {t('reviews.title')}
        </h2>
        <p lang="ar" dir="rtl" className="mt-2 text-center font-arabic text-2xl text-ink">
          {t('reviews.titleAr')}
        </p>
        <p className="mx-auto mt-4 max-w-2xl text-center text-[13px] leading-relaxed text-ink-muted">
          {t('reviews.lead')}
        </p>

        <ul className="mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {reviews.map((review) => (
            <li
              key={review.id}
              className="flex flex-col rounded-[var(--radius-card)] border border-line bg-white p-6"
            >
              <Quote className="size-6 shrink-0 text-gold-400" aria-hidden="true" />

              <blockquote className="mt-4 flex-1 text-[14px] leading-relaxed text-ink-muted">
                {review.quote}
              </blockquote>

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
          ))}
        </ul>
      </div>
    </section>
  );
}
