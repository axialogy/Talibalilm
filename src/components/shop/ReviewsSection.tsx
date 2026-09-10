import { useMemo, useState } from 'react';
import { Star } from 'lucide-react';
import { toast } from 'sonner';
import { useGlowStore } from '@/context/GlowStore';
import { useI18n } from '@/i18n';
import { cn } from '@/lib/utils';

function Stars({ value, className }: { value: number; className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-0.5', className)} aria-hidden="true">
      {[1, 2, 3, 4, 5].map(i => (
        <Star
          key={i}
          className={cn(
            'h-3.5 w-3.5',
            i <= Math.round(value) ? 'fill-charcoal text-charcoal' : 'text-charcoal/20',
          )}
        />
      ))}
    </span>
  );
}

export function ReviewsSection({
  productId,
  productName,
}: {
  productId: string;
  productName: string;
}) {
  const { t, locale } = useI18n();
  const { reviews, addReview } = useGlowStore();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');

  const published = useMemo(
    () => reviews.filter(r => r.productId === productId && r.published),
    [reviews, productId],
  );

  const average = useMemo(
    () =>
      published.length === 0
        ? 0
        : published.reduce((sum, r) => sum + r.rating, 0) / published.length,
    [published],
  );

  const dateFmt = new Intl.DateTimeFormat(locale === 'ar' ? 'ar-DZ' : 'en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !comment.trim()) return;
    addReview({ productId, productName, name: name.trim(), rating, comment: comment.trim() });
    toast.success(t('reviewThanks'));
    setName('');
    setComment('');
    setRating(5);
    setOpen(false);
  }

  return (
    <section className="border-t border-border pt-14">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-3xl">{t('reviewsTitle')}</h2>
          {published.length > 0 && (
            <div className="mt-2 flex items-center gap-2.5">
              <Stars value={average} />
              <span className="text-sm text-muted-foreground">
                {average.toFixed(1)} · {t('basedOn', { n: published.length })}
              </span>
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={() => setOpen(o => !o)}
          className="cursor-pointer rounded-full border border-border bg-background px-5 py-2.5 text-sm transition-colors duration-200 hover:border-charcoal/30"
        >
          {open ? t('cancel') : t('writeReview')}
        </button>
      </div>

      {open && (
        <form
          onSubmit={submit}
          className="mt-7 animate-scale-in rounded-2xl border border-border bg-card p-6"
        >
          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label htmlFor="rv-name" className="mb-1.5 block text-sm font-medium">
                {t('reviewName')}
              </label>
              <input
                id="rv-name"
                required
                value={name}
                onChange={e => setName(e.target.value)}
                className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm outline-none transition-colors focus:border-charcoal/40"
              />
            </div>

            <div>
              <span className="mb-1.5 block text-sm font-medium">{t('reviewRating')}</span>
              <div className="flex items-center gap-1 py-1.5">
                {[1, 2, 3, 4, 5].map(i => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setRating(i)}
                    aria-label={`${i} / 5`}
                    aria-pressed={rating === i}
                    className="cursor-pointer rounded p-0.5"
                  >
                    <Star
                      className={cn(
                        'h-5 w-5 transition-colors',
                        i <= rating ? 'fill-charcoal text-charcoal' : 'text-charcoal/20',
                      )}
                    />
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-5">
            <label htmlFor="rv-comment" className="mb-1.5 block text-sm font-medium">
              {t('reviewComment')}
            </label>
            <textarea
              id="rv-comment"
              required
              rows={4}
              value={comment}
              onChange={e => setComment(e.target.value)}
              className="w-full resize-y rounded-xl border border-border bg-background px-4 py-3 text-sm outline-none transition-colors focus:border-charcoal/40"
            />
          </div>

          <button
            type="submit"
            className="mt-5 cursor-pointer rounded-full bg-charcoal px-6 py-3 text-sm font-medium text-white transition-all duration-300 hover:bg-charcoal-soft"
          >
            {t('reviewSubmit')}
          </button>
        </form>
      )}

      <div className="mt-9">
        {published.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('reviewsEmpty')}</p>
        ) : (
          <ul className="grid gap-5 sm:grid-cols-2">
            {published.map(r => (
              <li key={r.id} className="rounded-2xl border border-border bg-card p-6">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-medium">{r.name}</span>
                  <Stars value={r.rating} />
                </div>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{r.comment}</p>
                <p className="mt-3 text-xs text-muted-foreground/70">
                  {dateFmt.format(new Date(r.createdAt))}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
