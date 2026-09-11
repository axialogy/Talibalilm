import { getTranslations, setRequestLocale } from 'next-intl/server';
import { BackLink } from '@/components/admin/BackLink';
import { PackEditor, type PackView, type ProductChoice } from '@/components/admin/PackEditor';
import { formatPrice } from '@/lib/commerce/quote';
import { createClient } from '@/lib/supabase/server';

/** Offers. A pack is data, so "buy one get one" never becomes a branch in code. */
export default async function AdminPacksPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations('admin');
  const supabase = await createClient();

  const [{ data: packs }, { data: products }] = await Promise.all([
    supabase
      .from('packs')
      .select(
        `id, slug, title, description, delivery, pricing, price_cents, percent_off, status,
         max_redemptions, display_order, pack_items ( product_id, is_free )`,
      )
      .order('display_order', { ascending: true }),
    supabase
      .from('products')
      .select('id, delivery, price_cents, courses ( title ), cursus ( title )')
      .neq('status', 'archived')
      .order('display_order', { ascending: true }),
  ]);

  const choices: ProductChoice[] = (products ?? []).map((row) => ({
    id: row.id,
    delivery: row.delivery,
    label: row.courses?.title ?? row.cursus?.title ?? '—',
    price: formatPrice(row.price_cents, locale),
  }));

  const views: PackView[] = (packs ?? []).map((row) => ({
    id: row.id,
    slug: row.slug,
    title: row.title,
    description: row.description,
    delivery: row.delivery,
    pricing: row.pricing,
    priceCents: row.price_cents,
    percentOff: row.percent_off,
    status: row.status,
    maxRedemptions: row.max_redemptions,
    displayOrder: row.display_order,
    items: (row.pack_items ?? []).map((i) => ({ productId: i.product_id, isFree: i.is_free })),
  }));

  return (
    <div>
      <BackLink href="/admin" label={t('navOverview')} />
      <h1 className="font-display text-2xl font-semibold text-ink">{t('packList')}</h1>
      <p className="mt-2 max-w-2xl text-[13px] leading-relaxed text-ink-muted">
        {t('packListLead')}
      </p>

      {views.length === 0 && (
        <p className="mt-8 rounded-[var(--radius-card)] border border-dashed border-line bg-surface/50 p-8 text-center text-sm text-ink-muted">
          {t('noPacks')}
        </p>
      )}

      <div className="mt-8 space-y-6">
        {views.map((pack) => (
          <PackEditor key={pack.id} pack={pack} products={choices} />
        ))}
      </div>

      <section className="mt-10">
        <h2 className="font-display text-lg font-semibold text-ink">{t('newPack')}</h2>
        <p className="mt-1 text-[12px] text-ink-muted">{t('packItems')} →</p>
        <div className="mt-3">
          <PackEditor products={choices} />
        </div>
      </section>
    </div>
  );
}
