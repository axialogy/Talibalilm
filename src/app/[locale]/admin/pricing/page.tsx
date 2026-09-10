import { getTranslations, setRequestLocale } from 'next-intl/server';
import { ProductForm, DeleteProductButton, type ProductRowView } from '@/components/admin/ProductForm';
import { Badge } from '@/components/ui/badge';
import { formatPrice } from '@/lib/commerce/quote';
import { createClient } from '@/lib/supabase/server';

/**
 * The price list.
 *
 * Read through the ordinary anon client, so staff see draft rows because
 * `products_select_staff` says they may — not because this page asked for
 * them. A student reaching this URL would get an empty table before the guard
 * in the layout ever mattered.
 */
export default async function AdminPricingPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations('admin');
  const supabase = await createClient();

  const [{ data: products }, { data: courses }, { data: cursus }] = await Promise.all([
    supabase
      .from('products')
      .select(
        `id, kind, course_id, cursus_id, year_index, delivery, time_slot, schedule_label,
         hours_per_year, hours_per_week, language, price_cents, duration_days, status,
         display_order, courses ( title ), cursus ( title )`,
      )
      .order('delivery', { ascending: true })
      .order('time_slot', { ascending: true })
      .order('display_order', { ascending: true }),
    supabase.from('courses').select('id, title').order('display_order', { ascending: true }),
    supabase.from('cursus').select('id, title').order('display_order', { ascending: true }),
  ]);

  const rows: ProductRowView[] = (products ?? []).map((row) => ({
    id: row.id,
    kind: row.kind,
    courseId: row.course_id,
    cursusId: row.cursus_id,
    yearIndex: row.year_index,
    delivery: row.delivery,
    timeSlot: row.time_slot,
    scheduleLabel: row.schedule_label,
    hoursPerYear: row.hours_per_year,
    hoursPerWeek: row.hours_per_week,
    language: row.language,
    priceCents: row.price_cents,
    durationDays: row.duration_days,
    status: row.status,
    displayOrder: row.display_order,
    label: row.courses?.title ?? row.cursus?.title ?? '—',
  }));

  const options = { courses: courses ?? [], cursus: cursus ?? [] };

  // Grouped the way the school's own planning page groups them: by mode, then
  // by time slot.
  const groups = new Map<string, ProductRowView[]>();
  for (const row of rows) {
    const key = `${row.delivery}|${row.timeSlot}`;
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }

  return (
    <div>
      <h1 className="font-display text-2xl font-semibold text-ink">{t('priceList')}</h1>
      <p className="mt-2 max-w-2xl text-[13px] leading-relaxed text-ink-muted">
        {t('priceListLead')}
      </p>

      {rows.length === 0 ? (
        <p className="mt-8 rounded-[var(--radius-card)] border border-dashed border-line bg-surface/50 p-8 text-center text-sm text-ink-muted">
          {t('noProducts')}
        </p>
      ) : (
        <div className="mt-8 space-y-8">
          {[...groups.entries()].map(([key, group]) => {
            const [delivery, slot] = key.split('|');
            return (
              <section key={key}>
                <h2 className="flex flex-wrap items-center gap-2 text-[13px] font-medium text-ink">
                  {delivery === 'presentiel' ? t('deliveryPresentiel') : t('deliveryOnline')}
                  {slot && <Badge variant="soft">{slot}</Badge>}
                </h2>

                <ul className="mt-3 space-y-2">
                  {group.map((row) => (
                    <li
                      key={row.id}
                      className="flex flex-wrap items-center gap-3 rounded-[var(--radius-card)] border border-line bg-white p-4"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="font-display text-[15px] font-semibold text-ink">
                          {row.label}
                          {row.kind === 'cursus' && ` — ${t('yearIndex')} ${row.yearIndex}`}
                        </p>
                        <p className="text-[11px] text-ink-muted">
                          {[
                            row.scheduleLabel,
                            row.hoursPerYear ? `${row.hoursPerYear}h/an` : null,
                            row.hoursPerWeek ? `${row.hoursPerWeek / 10}h/sem` : null,
                            row.language.toUpperCase(),
                          ]
                            .filter(Boolean)
                            .join(' · ')}
                        </p>
                      </div>
                      {row.status !== 'published' && (
                        <Badge variant="soft">{t(row.status as 'draft')}</Badge>
                      )}
                      <p className="font-display text-[15px] font-semibold text-ink">
                        {formatPrice(row.priceCents, locale)}
                      </p>
                      <details className="w-full">
                        <summary className="cursor-pointer text-[12px] text-ink-muted transition-colors hover:text-brand-600">
                          {t('editProduct')}
                        </summary>
                        <div className="mt-3">
                          <ProductForm product={row} {...options} />
                          <div className="mt-2 flex justify-end">
                            <DeleteProductButton id={row.id} />
                          </div>
                        </div>
                      </details>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      )}

      <section className="mt-10">
        <h2 className="font-display text-lg font-semibold text-ink">{t('newProduct')}</h2>
        <div className="mt-3">
          <ProductForm {...options} />
        </div>
      </section>
    </div>
  );
}
