import { getTranslations, setRequestLocale } from 'next-intl/server';
import { BackLink } from '@/components/admin/BackLink';
import { Badge } from '@/components/ui/badge';
import { CouponGenerator } from '@/components/admin/CouponGenerator';
import { BonusEditor, type BonusRow, type ProductChoice } from '@/components/admin/BonusEditor';
import { ExportCsvButton, VoidCouponButton, type CsvRow } from '@/components/admin/CouponActions';
import { formatPrice } from '@/lib/commerce/quote';
import { couponBatches, listCoupons } from '@/lib/data/admin';
import { requireAdmin } from '@/lib/auth/guards';
import { createClient } from '@/lib/supabase/server';

/** Cash codes for the front desk: generate, track, export, void. Admin only. */
export default async function AdminCouponsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ batch?: string }>;
}) {
  const { locale } = await params;
  const { batch } = await searchParams;
  setRequestLocale(locale);

  await requireAdmin();
  const t = await getTranslations('admin');

  const supabase = await createClient();
  const [coupons, batches, { data: productRows }, { data: packRows }] = await Promise.all([
    listCoupons(batch),
    couponBatches(),
    supabase
      .from('products')
      .select('id, delivery, price_cents, courses ( title ), cursus ( title )')
      .eq('status', 'published')
      .order('display_order'),
    supabase
      .from('packs')
      .select('id, title, status, max_redemptions, redeemed_count, pack_items ( product_id, is_free )')
      .order('display_order'),
  ]);

  const products: ProductChoice[] = (productRows ?? []).map((p) => ({
    id: p.id,
    delivery: p.delivery,
    label: `${p.courses?.title ?? p.cursus?.title ?? ''} — ${
      p.delivery === 'online' ? t('deliveryOnline') : t('deliveryPresentiel')
    }`,
  }));

  // A bonus is a pack carrying exactly one free item; anything else on this
  // table is a bundle built on the Offers screen and is left alone here.
  const bonuses: BonusRow[] = (packRows ?? [])
    .filter((p) => (p.pack_items ?? []).some((i) => i.is_free))
    .map((p) => ({
      id: p.id,
      title: p.title,
      status: p.status,
      buyProductId: (p.pack_items ?? []).find((i) => !i.is_free)?.product_id ?? null,
      freeProductId: (p.pack_items ?? []).find((i) => i.is_free)?.product_id ?? null,
      maxRedemptions: p.max_redemptions,
      redeemedCount: p.redeemed_count,
    }));

  const discount = (c: (typeof coupons)[number]) =>
    c.percentOff !== null ? `${c.percentOff}%` : formatPrice(c.amountOffCents ?? 0, locale);

  const csv: CsvRow[] = coupons.map((c) => ({
    code: c.code,
    batch: c.batch,
    discount: discount(c),
    used: c.redeemedCount,
    max: c.maxRedemptions,
    spent: c.spent,
  }));

  return (
    <div>
      <BackLink href="/admin" label={t('navOverview')} />
      <h1 className="font-display text-2xl font-semibold text-ink">{t('promoTitle')}</h1>
      <p className="mt-2 max-w-2xl text-[13px] leading-relaxed text-ink-muted">{t('promoLead')}</p>

      <section className="mt-8">
        <h2 className="font-display text-[15px] font-semibold text-ink">{t('bonusTitle')}</h2>
        <p className="mt-1 mb-3 max-w-2xl text-[12px] leading-relaxed text-ink-muted">
          {t('bonusLead')}
        </p>
        <BonusEditor products={products} bonuses={bonuses} />
      </section>

      <section className="mt-10">
        <h2 className="font-display text-[15px] font-semibold text-ink">{t('generateTitle')}</h2>
        <div className="mt-3">
          <CouponGenerator />
        </div>
      </section>

      <div className="mt-10 flex flex-wrap items-end justify-between gap-3">
        <form className="flex items-end gap-2">
          <label className="block">
            <span className="mb-1.5 block text-[12px] font-medium text-ink-muted">{t('filterBatch')}</span>
            <select
              name="batch"
              defaultValue={batch ?? ''}
              className="rounded-[var(--radius-input)] border border-line bg-white px-3 py-2 text-sm text-ink"
            >
              <option value="">{t('filterAllBatches')}</option>
              {batches.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          </label>
          <button
            type="submit"
            className="rounded-full border border-line px-4 py-2 text-[13px] text-ink-muted transition-colors hover:border-brand-300"
          >
            {t('filterBatch')}
          </button>
        </form>
        <ExportCsvButton rows={csv} filename={`coupons-${batch || 'all'}.csv`} />
      </div>

      {coupons.length === 0 ? (
        <p className="mt-6 rounded-[var(--radius-card)] border border-dashed border-line bg-surface/50 p-8 text-center text-sm text-ink-muted">
          {t('couponsEmpty')}
        </p>
      ) : (
        <div className="mt-4 overflow-x-auto rounded-[var(--radius-card)] border border-line">
          <table className="w-full min-w-[620px] border-collapse text-[13px]">
            <thead>
              <tr className="bg-surface/60 text-left text-[11px] tracking-wide text-ink-muted uppercase">
                <th className="p-3 font-medium">{t('colCode')}</th>
                <th className="p-3 font-medium">{t('colDiscount')}</th>
                <th className="p-3 font-medium">{t('colUses')}</th>
                <th className="p-3 font-medium">{t('colBatch')}</th>
                <th className="p-3 font-medium">{t('colStatus')}</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {coupons.map((c) => (
                <tr key={c.id} className="transition-colors hover:bg-brand-50/40">
                  <td className="p-3 font-mono text-ink">
                    {c.code}
                    {c.isOffice && (
                      <Badge variant="gold" className="ml-2">
                        {t('couponOffice')}
                      </Badge>
                    )}
                  </td>
                  <td className="p-3 text-ink">{discount(c)}</td>
                  <td className="p-3 text-ink-muted tabular-nums">
                    {c.redeemedCount}
                    {c.maxRedemptions !== null && ` / ${c.maxRedemptions}`}
                  </td>
                  <td className="p-3 text-ink-muted">{c.batch || '—'}</td>
                  <td className="p-3">
                    <Badge variant={c.spent ? 'muted' : 'success'}>
                      {c.spent ? t('couponSpent') : t('couponAvailable')}
                    </Badge>
                  </td>
                  <td className="p-3 text-right">
                    {!c.spent && <VoidCouponButton couponId={c.id} />}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
