import { createClient } from '@/lib/supabase/server';
import { supabaseConfigured } from '@/lib/env';
import type { OfferPack } from '@/lib/commerce/quote';
import type { PlanningEntry } from '@/components/marketing/PlanningTarifs';
import type { CursusKind, DeliveryMode } from '@/lib/supabase/database.types';

/**
 * Catalogue reads for the shop.
 *
 * All of it goes through the ordinary anon client, so the same RLS that makes
 * the catalogue public is what serves it. A draft price never reaches this
 * code, which is why `priceSelection` does not re-check publication.
 */

export interface CursusSummary {
  id: string;
  slug: string;
  kind: CursusKind;
  title: string;
  subtitle: string;
  description: string;
  yearCount: number;
}

export interface ProgrammeEntry {
  courseId: string;
  courseSlug: string;
  courseTitle: string;
  courseSubtitle: string;
  yearIndex: number;
  position: number;
}

export async function listCursus(): Promise<CursusSummary[]> {
  if (!supabaseConfigured) return [];

  const supabase = await createClient();
  const { data } = await supabase
    .from('cursus')
    .select('id, slug, kind, title, subtitle, description, year_count')
    .eq('status', 'published')
    .order('display_order', { ascending: true });

  return (data ?? []).map((row) => ({
    id: row.id,
    slug: row.slug,
    kind: row.kind,
    title: row.title,
    subtitle: row.subtitle,
    description: row.description,
    yearCount: row.year_count,
  }));
}

export async function getCursus(slug: string): Promise<CursusSummary | null> {
  const all = await listCursus();
  return all.find((c) => c.slug === slug) ?? null;
}

/**
 * The programme of a cursus, for one delivery mode.
 *
 * Keyed by delivery because the on-site and online programmes are genuinely
 * different lists — which is the same reason the entitlement check matches on
 * it. The two must agree, so they read the same table.
 */
export async function getProgramme(
  cursusId: string,
  delivery: DeliveryMode,
): Promise<ProgrammeEntry[]> {
  if (!supabaseConfigured) return [];

  const supabase = await createClient();
  const { data } = await supabase
    .from('cursus_courses')
    .select('course_id, year_index, position, courses ( slug, title, subtitle )')
    .eq('cursus_id', cursusId)
    .eq('delivery', delivery)
    .order('year_index', { ascending: true })
    .order('position', { ascending: true });

  return (data ?? [])
    .filter((row): row is typeof row & { courses: NonNullable<typeof row.courses> } =>
      row.courses !== null,
    )
    .map((row) => ({
      courseId: row.course_id,
      courseSlug: row.courses.slug,
      courseTitle: row.courses.title,
      courseSubtitle: row.courses.subtitle,
      yearIndex: row.year_index,
      position: row.position,
    }));
}

/** Group a programme by year, in reading order. */
export function programmeByYear(entries: ProgrammeEntry[]): Map<number, ProgrammeEntry[]> {
  const years = new Map<number, ProgrammeEntry[]>();
  for (const entry of entries) {
    const list = years.get(entry.yearIndex) ?? [];
    list.push(entry);
    years.set(entry.yearIndex, list);
  }
  return new Map([...years.entries()].sort((a, b) => a[0] - b[0]));
}

/**
 * Every purchasable offering in one delivery mode.
 *
 * The title is joined in here rather than stored on the product, so renaming a
 * course renames what the shop calls it. `order_items` snapshots the title at
 * purchase, which is where a stable historical record belongs.
 */
export async function listProducts(delivery: DeliveryMode): Promise<PlanningEntry[]> {
  if (!supabaseConfigured) return [];

  const supabase = await createClient();
  const { data } = await supabase
    .from('products')
    .select(
      `id, kind, course_id, cursus_id, year_index, delivery, time_slot, schedule_label,
       hours_per_year, hours_per_week, language, price_cents, currency, duration_days,
       courses ( title ), cursus ( title )`,
    )
    .eq('status', 'published')
    .eq('delivery', delivery)
    .order('time_slot', { ascending: true })
    .order('display_order', { ascending: true });

  return (data ?? []).map((row) => ({
    id: row.id,
    kind: row.kind,
    courseId: row.course_id,
    cursusId: row.cursus_id,
    yearIndex: row.year_index,
    delivery: row.delivery,
    priceCents: row.price_cents,
    currency: row.currency,
    durationDays: row.duration_days,
    title: row.courses?.title ?? row.cursus?.title ?? '',
    timeSlot: row.time_slot,
    scheduleLabel: row.schedule_label,
    hoursPerYear: row.hours_per_year,
    hoursPerWeek: row.hours_per_week,
    teachingLanguage: row.language,
  }));
}

/** The offers currently on, in one delivery mode. */
export async function listPacks(delivery: DeliveryMode): Promise<OfferPack[]> {
  if (!supabaseConfigured) return [];

  const supabase = await createClient();
  const { data } = await supabase
    .from('packs')
    .select(
      `id, slug, title, delivery, pricing, price_cents, percent_off,
       pack_items ( product_id, is_free, position )`,
    )
    .eq('status', 'published')
    .eq('delivery', delivery)
    .order('display_order', { ascending: true });

  return (data ?? []).map((row) => {
    const items = (row.pack_items ?? []).slice().sort((a, b) => a.position - b.position);
    return {
      id: row.id,
      slug: row.slug,
      title: row.title,
      delivery: row.delivery,
      pricing: row.pricing,
      priceCents: row.price_cents,
      percentOff: row.percent_off,
      paidProductIds: items.filter((i) => !i.is_free).map((i) => i.product_id),
      freeProductIds: items.filter((i) => i.is_free).map((i) => i.product_id),
    };
  });
}
