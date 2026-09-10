import { useState, useMemo } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { Star, Trash2, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';
import { useGlowStore } from '@/context/GlowStore';
import { useI18n } from '@/i18n';
import {
  PageHeader, TableWrap, Th, Td, EmptyRow, Btn, Pill,
} from '@/components/admin/AdminUI';
import { cn } from '@/lib/utils';

export const Route = createFileRoute('/admin/reviews')({
  component: ReviewsAdminPage,
});

function ReviewsAdminPage() {
  const { t, locale } = useI18n();
  const { reviews, setReviewPublished, deleteReview } = useGlowStore();
  const [filter, setFilter] = useState<'all' | 'pending' | 'published'>('all');

  const visible = useMemo(() => {
    if (filter === 'pending') return reviews.filter(r => !r.published);
    if (filter === 'published') return reviews.filter(r => r.published);
    return reviews;
  }, [reviews, filter]);

  const pendingCount = reviews.filter(r => !r.published).length;

  const dateFmt = new Intl.DateTimeFormat(locale === 'ar' ? 'ar-DZ' : 'en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  return (
    <>
      <PageHeader
        title={t('adminReviews')}
        subtitle={pendingCount > 0 ? t('statReviews') + `: ${pendingCount}` : undefined}
      />

      <div className="mb-5 flex gap-1.5">
        {(['all', 'pending', 'published'] as const).map(f => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            aria-pressed={filter === f}
            className={cn(
              'cursor-pointer rounded-full border px-3.5 py-1.5 text-xs transition-all duration-200',
              filter === f
                ? 'border-charcoal bg-charcoal text-white'
                : 'border-border bg-background text-muted-foreground hover:border-charcoal/30',
            )}
          >
            {f === 'all' ? t('allStatuses') : f === 'pending' ? t('reviewPending') : t('reviewPublished')}
          </button>
        ))}
      </div>

      <TableWrap>
        <thead>
          <tr>
            <Th>{t('reviewAuthor')}</Th>
            <Th>{t('reviewProduct')}</Th>
            <Th>{t('reviewRating')}</Th>
            <Th>{t('reviewComment')}</Th>
            <Th>{t('orderDate')}</Th>
            <Th className="w-32" />
          </tr>
        </thead>
        <tbody>
          {visible.length === 0 ? (
            <EmptyRow colSpan={6}>{t('noReviews')}</EmptyRow>
          ) : (
            visible.map(r => (
              <tr key={r.id}>
                <Td>
                  <span className="font-medium">{r.name}</span>
                  <span className="mt-1 block">
                    <Pill tone={r.published ? 'good' : 'warn'}>
                      {r.published ? t('reviewPublished') : t('reviewPending')}
                    </Pill>
                  </span>
                </Td>
                <Td className="text-muted-foreground">{r.productName}</Td>
                <Td>
                  <span className="inline-flex items-center gap-0.5" aria-label={`${r.rating}/5`}>
                    {[1, 2, 3, 4, 5].map(i => (
                      <Star
                        key={i}
                        className={cn(
                          'h-3.5 w-3.5',
                          i <= r.rating ? 'fill-charcoal text-charcoal' : 'text-charcoal/20',
                        )}
                      />
                    ))}
                  </span>
                </Td>
                <Td className="max-w-[280px]">
                  <p className="line-clamp-3 text-muted-foreground">{r.comment}</p>
                </Td>
                <Td className="whitespace-nowrap text-muted-foreground">
                  {dateFmt.format(new Date(r.createdAt))}
                </Td>
                <Td>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setReviewPublished(r.id, !r.published)}
                      aria-label={r.published ? t('reviewUnpublish') : t('reviewPublish')}
                      title={r.published ? t('reviewUnpublish') : t('reviewPublish')}
                      className="cursor-pointer rounded-lg p-2 transition-colors hover:bg-secondary"
                    >
                      {r.published ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        deleteReview(r.id);
                        toast.success(t('delete'));
                      }}
                      aria-label={t('delete')}
                      className="cursor-pointer rounded-lg p-2 text-destructive transition-colors hover:bg-destructive/10"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </Td>
              </tr>
            ))
          )}
        </tbody>
      </TableWrap>

      {pendingCount > 0 && filter !== 'published' && (
        <div className="mt-5 flex justify-end">
          <Btn
            variant="ghost"
            onClick={() => {
              reviews.filter(r => !r.published).forEach(r => setReviewPublished(r.id, true));
              toast.success(t('reviewPublish'));
            }}
          >
            <Eye className="h-4 w-4" />
            {t('reviewPublish')} ({pendingCount})
          </Btn>
        </div>
      )}
    </>
  );
}
