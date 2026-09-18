import { getTranslations, setRequestLocale } from 'next-intl/server';
import { CheckCircle2, GraduationCap, Layers } from 'lucide-react';
import { Link, redirect } from '@/i18n/navigation';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatPrice } from '@/lib/commerce/quote';
import { getCourse } from '@/lib/data/courses';
import { createClient } from '@/lib/supabase/server';
import { supabaseConfigured } from '@/lib/env';
import { requireLocale } from '@/i18n/routing';

/**
 * After the money has moved.
 *
 * Read through the ordinary anon client, so `orders_select_own` decides what
 * is shown: an order id in the URL belonging to somebody else renders nothing.
 * The page is a receipt, not the thing that grants access — that already
 * happened server-side, in `grant_order_entitlements`.
 *
 * Each line opens what it bought. A module goes straight to its first lesson,
 * which is where a student who has just paid actually wants to be; a cursus
 * goes to Mon espace, where its courses are listed. Nothing is a dead label.
 */
export default async function ConfirmationPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ order?: string }>;
}) {
  const { locale } = await params;
  requireLocale(locale);
  const { order: orderId } = await searchParams;
  setRequestLocale(locale);

  if (!supabaseConfigured || !orderId) redirect({ href: '/dashboard', locale });

  const t = await getTranslations('checkout');
  const supabase = await createClient();

  const { data: order } = await supabase
    .from('orders')
    .select(
      `id, status, total_cents, currency,
       order_items ( product_id, title, schedule_label, kind, is_free, course_id, cursus_id, year_index )`,
    )
    .eq('id', orderId)
    .maybeSingle();

  if (!order || order.status !== 'paid') redirect({ href: '/dashboard', locale });

  const items = order.order_items ?? [];

  // The slugs, in one read rather than a join: `order_items` carries the
  // course id, and the catalogue is public.
  const courseIds = items
    .map((item) => item.course_id)
    .filter((id): id is string => id !== null);
  const { data: courses } = courseIds.length
    ? await supabase.from('courses').select('id, slug').in('id', courseIds)
    : { data: [] };
  const slugById = new Map((courses ?? []).map((course) => [course.id, course.slug]));

  // Where each line should open. The course is read through the public
  // catalogue, so this cannot become a way to reach something the paywall
  // would refuse — the lesson page itself is gated by RLS.
  const targets = await Promise.all(
    items.map(async (item) => {
      const slug = item.course_id ? slugById.get(item.course_id) : undefined;
      if (item.kind !== 'module' || !slug) return null;
      const course = await getCourse(slug);
      const first = course?.modules.flatMap((chapter) => chapter.lessons)[0];
      return first ? `/dashboard/courses/${slug}/lessons/${first.id}` : null;
    }),
  );

  return (
    <>
      <div className="text-center">
        <span
          className="mx-auto flex size-14 items-center justify-center rounded-full bg-brand-50 text-brand-600"
          aria-hidden="true"
        >
          <CheckCircle2 className="size-7" />
        </span>
        <h1 className="mt-5 font-display text-[clamp(1.5rem,3.4vw,2rem)] font-semibold text-ink">
          {t('confirmTitle')}
        </h1>
        <p className="mt-2 text-[14px] leading-relaxed text-ink-muted">{t('confirmLead')}</p>
        <p className="mt-1 text-[11px] tracking-wide text-ink-muted/80 uppercase">
          {t('confirmRef', { ref: order.id.slice(0, 8) })}
        </p>
      </div>

      <div className="mt-8 rounded-[var(--radius-card)] border border-line bg-white p-6">
        <h2 className="font-display text-[15px] font-semibold text-ink">{t('confirmItems')}</h2>
        <ul className="mt-4 divide-y divide-line">
          {items.map((item, index) => {
            const target = targets[index];
            return (
              <li key={item.product_id} className="flex flex-wrap items-center gap-3 py-3">
                <span
                  className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600"
                  aria-hidden="true"
                >
                  {item.kind === 'cursus' ? (
                    <GraduationCap className="size-4" />
                  ) : (
                    <Layers className="size-4" />
                  )}
                </span>

                <div className="min-w-0 flex-1">
                  <p className="text-[13px] text-ink">
                    {item.title}
                    {item.kind === 'cursus' && item.year_index > 0 && (
                      <span className="text-ink-muted"> — {t('yearLabel', { year: item.year_index })}</span>
                    )}
                  </p>
                  {item.schedule_label && (
                    <p className="text-[11px] text-ink-muted">{item.schedule_label}</p>
                  )}
                </div>

                {item.is_free && <Badge variant="success">{t('offerFree')}</Badge>}

                <Button asChild size="sm" variant="outline" className="shrink-0">
                  <Link href={target ?? '/dashboard'}>{t('confirmOpen')}</Link>
                </Button>
              </li>
            );
          })}
        </ul>

        <p className="mt-5 border-t border-line pt-4 text-right font-display text-lg font-semibold text-ink">
          {formatPrice(order.total_cents, locale, order.currency)}
        </p>
      </div>

      <div className="mt-8 text-center">
        <Button asChild size="lg">
          <Link href="/dashboard">{t('confirmCta')}</Link>
        </Button>
      </div>
    </>
  );
}
