'use client';

import { useActionState, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Plus, Star, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Field } from '@/components/ui/field';
import { SubmitButton } from '@/components/auth/SubmitButton';
import { deleteReview, saveReview, setReviewStatus } from '@/app/actions/site';
import type { AdminState } from '@/app/actions/admin';
import type { ReviewView } from '@/lib/data/site';
import { cn } from '@/lib/utils';

/** `ok` means "the save succeeded", so nothing has succeeded yet. */
const IDLE: AdminState = { ok: false };

/**
 * Student testimonials, from the office's side.
 *
 * Draft by default and published deliberately, like the events — a quote is
 * attributed to a named person, and a half-typed one appearing under their
 * name on the home page is the mistake worth designing against.
 */
export function ReviewsEditor({ reviews }: { reviews: ReviewView[] }) {
  const t = useTranslations('admin');
  const [adding, setAdding] = useState(false);

  return (
    <div className="max-w-3xl space-y-6">
      {!adding && (
        <Button type="button" size="sm" onClick={() => setAdding(true)}>
          <Plus className="size-4" aria-hidden="true" />
          {t('reviewNew')}
        </Button>
      )}

      {adding && <ReviewForm onDone={() => setAdding(false)} />}

      {reviews.length === 0 ? (
        <p className="rounded-[var(--radius-card)] border border-dashed border-line bg-surface/50 p-8 text-center text-sm text-ink-muted">
          {t('reviewsEmpty')}
        </p>
      ) : (
        <ul className="space-y-4">
          {reviews.map((review) => (
            <li
              key={review.id}
              className="rounded-[var(--radius-card)] border border-line bg-white p-5"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-display text-[15px] font-semibold text-ink">
                      {review.authorName}
                    </p>
                    <Badge variant={review.status === 'published' ? 'success' : 'muted'}>
                      {review.status === 'published' ? t('publish') : t('statusDraft')}
                    </Badge>
                  </div>
                  {review.authorContext && (
                    <p className="mt-0.5 text-[11px] text-ink-muted">{review.authorContext}</p>
                  )}
                </div>

                <p className="flex shrink-0 items-center gap-0.5">
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

              <blockquote className="mt-3 text-[13px] leading-relaxed text-ink-muted">
                {review.quote}
              </blockquote>

              <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-line pt-4">
                <StatusButton id={review.id} published={review.status === 'published'} />
                <DeleteButton id={review.id} />
              </div>

              <details className="mt-3">
                <summary className="cursor-pointer text-[12px] text-brand-600">{t('edit')}</summary>
                <div className="mt-3">
                  <ReviewForm review={review} />
                </div>
              </details>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ReviewForm({ review, onDone }: { review?: ReviewView; onDone?: () => void }) {
  const t = useTranslations('admin');
  const [state, action] = useActionState(saveReview, IDLE);

  useEffect(() => {
    if (state.ok && onDone) onDone();
  }, [state.ok, onDone]);

  return (
    <form
      action={action}
      className="space-y-3 rounded-[var(--radius-card)] border border-line bg-surface/40 p-5"
    >
      {review && <input type="hidden" name="id" value={review.id} />}

      <Field
        label={t('reviewAuthor')}
        name="author_name"
        defaultValue={review?.authorName ?? ''}
        required
      />
      <Field
        label={t('reviewContext')}
        name="author_context"
        defaultValue={review?.authorContext ?? ''}
      />

      <label className="block">
        <span className="mb-1.5 block text-[13px] font-medium text-ink">{t('reviewQuote')}</span>
        <textarea
          name="quote"
          rows={4}
          required
          minLength={10}
          maxLength={1200}
          defaultValue={review?.quote ?? ''}
          className="w-full rounded-[var(--radius-input)] border border-line bg-white px-4 py-3 text-sm text-ink outline-none focus:border-brand-400"
        />
      </label>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field
          label={t('reviewRating')}
          name="rating"
          type="number"
          min={1}
          max={5}
          defaultValue={review?.rating ?? 5}
        />
        <Field
          label={t('displayOrder')}
          name="display_order"
          type="number"
          min={0}
          defaultValue={review?.displayOrder ?? 0}
        />
      </div>

      {state.error && (
        <p role="alert" className="text-[12px] text-red-600">
          {t(`errors.${state.error}` as 'errors.saveFailed')}
        </p>
      )}

      <div className="flex items-center gap-3">
        <SubmitButton size="sm" block={false}>
          {review ? t('save') : t('add')}
        </SubmitButton>
        {onDone && (
          <Button type="button" size="sm" variant="ghost" onClick={onDone}>
            {t('cancel')}
          </Button>
        )}
      </div>
    </form>
  );
}

function StatusButton({ id, published }: { id: string; published: boolean }) {
  const t = useTranslations('admin');
  const [, action] = useActionState(setReviewStatus, IDLE);
  return (
    <form action={action}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="status" value={published ? 'draft' : 'published'} />
      <Button type="submit" size="sm" variant={published ? 'outline' : 'primary'}>
        {published ? t('unpublish') : t('publish')}
      </Button>
    </form>
  );
}

function DeleteButton({ id }: { id: string }) {
  const t = useTranslations('admin');
  const [, action] = useActionState(deleteReview, IDLE);
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!confirm(t('confirmDeleteSimple'))) e.preventDefault();
      }}
    >
      <input type="hidden" name="id" value={id} />
      <Button type="submit" size="sm" variant="ghost">
        <Trash2 className="size-3.5" aria-hidden="true" />
        {t('delete')}
      </Button>
    </form>
  );
}
