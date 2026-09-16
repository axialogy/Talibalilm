import { getTranslations } from 'next-intl/server';
import { ReviewsCarousel } from '@/components/marketing/ReviewsCarousel';
import type { ReviewView } from '@/lib/data/site';

/**
 * What students say.
 *
 * Like the events grid, absent rather than empty when nothing is published —
 * and nothing is seeded, because a testimonial is a sentence attributed to a
 * real person and inventing one is not a design decision that was ours to
 * make.
 *
 * The cards live in a client carousel: they scroll sideways with snap points,
 * keep one height whatever their length, and clamp a long quote behind a
 * "Lire la suite" button.
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
        <p className="mx-auto mt-4 max-w-2xl text-center text-[13px] leading-relaxed text-ink-muted">
          {t('reviews.lead')}
        </p>

        <div className="mt-10">
          <ReviewsCarousel
            reviews={reviews.map((review) => ({
              id: review.id,
              authorName: review.authorName,
              authorContext: review.authorContext,
              quote: review.quote,
              rating: review.rating,
              avatarUrl: review.avatarUrl,
            }))}
            labels={{
              readMore: t('reviews.readMore'),
              readLess: t('reviews.readLess'),
              previous: t('reviews.previous'),
              next: t('reviews.next'),
            }}
          />
        </div>
      </div>
    </section>
  );
}
