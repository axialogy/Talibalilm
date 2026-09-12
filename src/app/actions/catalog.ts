'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { supabaseConfigured } from '@/lib/env';
import { requireAdmin, requireStaff } from '@/lib/auth/guards';
import type { AdminState } from '@/app/actions/admin';

/**
 * Price list, offers and programme.
 *
 * Everything here writes through the ordinary anon-key client, so the
 * `is_staff()` policies apply — an authoring screen has no business bypassing
 * the rules it is authoring under. The one exception is payment settings,
 * which no browser session may read or write at all and which therefore goes
 * through the service role after an explicit admin check.
 */

const OK: AdminState = { ok: true };

async function client() {
  if (!supabaseConfigured) throw new Error('unavailable');
  await requireStaff();
  return createClient();
}

function refresh() {
  revalidatePath('/[locale]/admin/courses/[id]', 'page');
  revalidatePath('/[locale]/admin/cursus', 'page');
  revalidatePath('/[locale]/pricing', 'page');
  revalidatePath('/[locale]/checkout/modules', 'page');
}

// ---------------------------------------------------------------------------
// Products — the only place a price lives
// ---------------------------------------------------------------------------

const productSchema = z
  .object({
    id: z.string().uuid().optional(),
    kind: z.enum(['module', 'cursus']),
    course_id: z.string().uuid().nullable().default(null),
    cursus_id: z.string().uuid().nullable().default(null),
    year_index: z.coerce.number().int().min(1).max(10).default(1),
    delivery: z.enum(['presentiel', 'online']),
    time_slot: z
      .string()
      .max(40)
      .regex(/^[a-z0-9-]*$/, 'slugShape')
      .default(''),
    schedule_label: z.string().max(120).default(''),
    hours_per_year: z.coerce.number().int().min(0).max(2000).nullable().default(null),
    // Entered in hours, stored in tenths — "3.5" becomes 35, and no float ever
    // reaches the database.
    hours_per_week: z.coerce.number().min(0).max(70).nullable().default(null),
    language: z.enum(['fr', 'ar']).default('fr'),
    price_cents: z.coerce.number().int().min(0).max(10_000_00),
    duration_days: z.coerce.number().int().min(1).max(3650).default(365),
    status: z.enum(['draft', 'published', 'archived']).default('draft'),
    display_order: z.coerce.number().int().min(0).max(9999).default(0),
  })
  .refine(
    (v) =>
      v.kind === 'module' ? v.course_id !== null && v.cursus_id === null : v.cursus_id !== null,
    { message: 'targetRequired' },
  );

/** Euros as typed by a human — "300", "300,50", "300.5" — to integer cents. */
function toCents(raw: string): number | null {
  const cleaned = raw.trim().replace(/\s/g, '').replace(',', '.');
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  const [whole, fraction = ''] = cleaned.split('.');
  return Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
}

function readProduct(formData: FormData) {
  const priceCents = toCents(String(formData.get('price') ?? ''));
  const hoursWeek = String(formData.get('hours_per_week') ?? '').trim();
  const hoursYear = String(formData.get('hours_per_year') ?? '').trim();

  return {
    priceCents,
    fields: {
      id: (formData.get('id') as string) || undefined,
      kind: formData.get('kind'),
      course_id: (formData.get('course_id') as string) || null,
      cursus_id: (formData.get('cursus_id') as string) || null,
      year_index: formData.get('year_index') || 1,
      delivery: formData.get('delivery'),
      time_slot: formData.get('time_slot') ?? '',
      schedule_label: formData.get('schedule_label') ?? '',
      hours_per_year: hoursYear === '' ? null : hoursYear,
      // Tenths of an hour.
      hours_per_week: hoursWeek === '' ? null : Math.round(Number(hoursWeek.replace(',', '.')) * 10),
      language: formData.get('language') ?? 'fr',
      price_cents: priceCents ?? -1,
      duration_days: formData.get('duration_days') || 365,
      status: formData.get('status') ?? 'draft',
      display_order: formData.get('display_order') || 0,
    },
  };
}

export async function saveProduct(_prev: AdminState, formData: FormData): Promise<AdminState> {
  const { priceCents, fields } = readProduct(formData);
  if (priceCents === null) return { ok: false, error: 'priceInvalid' };

  const parsed = productSchema.safeParse(fields);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'invalid' };
  }

  const supabase = await client();
  const { id, ...row } = parsed.data;

  const { error } = id
    ? await supabase.from('products').update(row).eq('id', id)
    : await supabase.from('products').insert(row);

  if (error) {
    // The partial unique index is the likely cause: two live prices for the
    // same course, mode and slot have no answer to "which one is charged?".
    return { ok: false, error: error.code === '23505' ? 'duplicateSlot' : 'saveFailed' };
  }

  refresh();
  return OK;
}

export async function deleteProduct(_prev: AdminState, formData: FormData): Promise<AdminState> {
  const id = z.string().uuid().safeParse(formData.get('id'));
  if (!id.success) return { ok: false, error: 'invalid' };

  const supabase = await client();
  const { error } = await supabase.from('products').delete().eq('id', id.data);
  // `order_items` references products with ON DELETE RESTRICT, so a product
  // that has ever been bought cannot be deleted. Archiving is the way out.
  if (error) return { ok: false, error: error.code === '23503' ? 'productSold' : 'saveFailed' };

  refresh();
  return OK;
}

// ---------------------------------------------------------------------------
// Packs — the school's offers
// ---------------------------------------------------------------------------

const packSchema = z.object({
  id: z.string().uuid().optional(),
  slug: z
    .string()
    .min(2)
    .max(60)
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'slugShape'),
  title: z.string().min(2).max(200),
  description: z.string().max(2000).default(''),
  delivery: z.enum(['presentiel', 'online']),
  pricing: z.enum(['sum', 'fixed', 'percent']).default('sum'),
  percent_off: z.coerce.number().int().min(1).max(100).nullable().default(null),
  status: z.enum(['draft', 'published', 'archived']).default('draft'),
  max_redemptions: z.coerce.number().int().min(1).max(100_000).nullable().default(null),
  display_order: z.coerce.number().int().min(0).max(9999).default(0),
});

export async function savePack(_prev: AdminState, formData: FormData): Promise<AdminState> {
  const pricing = String(formData.get('pricing') ?? 'sum');
  const rawPrice = String(formData.get('price') ?? '').trim();
  const priceCents = rawPrice === '' ? null : toCents(rawPrice);
  if (pricing === 'fixed' && priceCents === null) return { ok: false, error: 'priceInvalid' };

  const percent = String(formData.get('percent_off') ?? '').trim();
  const parsed = packSchema.safeParse({
    id: (formData.get('id') as string) || undefined,
    slug: formData.get('slug'),
    title: formData.get('title'),
    description: formData.get('description') ?? '',
    delivery: formData.get('delivery'),
    pricing,
    percent_off: percent === '' ? null : percent,
    status: formData.get('status') ?? 'draft',
    max_redemptions: String(formData.get('max_redemptions') ?? '').trim() || null,
    display_order: formData.get('display_order') || 0,
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? 'invalid' };
  if (parsed.data.pricing === 'percent' && parsed.data.percent_off === null) {
    return { ok: false, error: 'percentRequired' };
  }

  const supabase = await client();
  const { id, ...row } = parsed.data;
  const payload = { ...row, price_cents: pricing === 'fixed' ? priceCents : null };

  const { error } = id
    ? await supabase.from('packs').update(payload).eq('id', id)
    : await supabase.from('packs').insert(payload);

  if (error) return { ok: false, error: error.code === '23505' ? 'slugTaken' : 'saveFailed' };

  revalidatePath('/[locale]/admin/packs', 'page');
  refresh();
  return OK;
}

export async function deletePack(_prev: AdminState, formData: FormData): Promise<AdminState> {
  const id = z.string().uuid().safeParse(formData.get('id'));
  if (!id.success) return { ok: false, error: 'invalid' };

  const supabase = await client();
  await supabase.from('packs').delete().eq('id', id.data);
  revalidatePath('/[locale]/admin/packs', 'page');
  refresh();
  return OK;
}

/**
 * A bonus, from two dropdowns.
 *
 * "Buy this, get that free" was already expressible — a pack priced by the sum
 * of its items, with `pack_items.is_free` on the giveaway — but saying it meant
 * inventing a slug, a title, a delivery mode and a pricing rule, then adding two
 * items by hand on a second screen. Four chances to get it wrong for an offer
 * the teacher thinks of as one sentence.
 *
 * So this takes the sentence: the product they pay for, and the one they
 * receive. Everything else is derived. The slug is random rather than built
 * from the titles, because renaming a course must not orphan a live offer.
 */
export async function saveBonus(_prev: AdminState, formData: FormData): Promise<AdminState> {
  const parsed = z
    .object({
      id: z.string().uuid().optional(),
      buy_product_id: z.string().uuid(),
      free_product_id: z.string().uuid(),
      status: z.enum(['draft', 'published', 'archived']).default('published'),
      max_redemptions: z.coerce.number().int().min(1).max(100_000).nullable().default(null),
    })
    .safeParse({
      id: (formData.get('id') as string) || undefined,
      buy_product_id: formData.get('buy_product_id'),
      free_product_id: formData.get('free_product_id'),
      status: formData.get('status') ?? 'published',
      max_redemptions: String(formData.get('max_redemptions') ?? '').trim() || null,
    });
  if (!parsed.success) return { ok: false, error: 'invalid' };

  const { id, buy_product_id, free_product_id, status, max_redemptions } = parsed.data;
  if (buy_product_id === free_product_id) return { ok: false, error: 'bonusSameProduct' };

  const supabase = await client();

  // Both halves must be the same mode. An on-site purchase that hands back an
  // online course is almost certainly a mis-click, and the basket could not
  // price it anyway — a pack carries one delivery.
  const { data: products } = await supabase
    .from('products')
    .select('id, delivery, course_id, cursus_id, courses ( title ), cursus ( title )')
    .in('id', [buy_product_id, free_product_id]);

  const buy = products?.find((p) => p.id === buy_product_id);
  const gift = products?.find((p) => p.id === free_product_id);
  if (!buy || !gift) return { ok: false, error: 'invalid' };
  if (buy.delivery !== gift.delivery) return { ok: false, error: 'bonusDeliveryMismatch' };

  const name = (p: typeof buy) => p.courses?.title ?? p.cursus?.title ?? '';
  const title = `${name(buy)} + ${name(gift)}`.slice(0, 200);

  const row = {
    title,
    delivery: buy.delivery,
    // The student pays for what they bought and nothing for the gift, so the
    // total is the sum of the items — the free one contributing zero.
    pricing: 'sum' as const,
    price_cents: null,
    percent_off: null,
    status,
    max_redemptions,
  };

  let packId = id;
  if (packId) {
    const { error } = await supabase.from('packs').update(row).eq('id', packId);
    if (error) return { ok: false, error: 'saveFailed' };
    // Replace the items rather than diffing: a bonus is exactly two.
    await supabase.from('pack_items').delete().eq('pack_id', packId);
  } else {
    const slug = `bonus-${Math.random().toString(36).slice(2, 10)}`;
    const { data: created, error } = await supabase
      .from('packs')
      .insert({ ...row, slug })
      .select('id')
      .single();
    if (error || !created) return { ok: false, error: 'saveFailed' };
    packId = created.id;
  }

  const { error: itemsError } = await supabase.from('pack_items').insert([
    { pack_id: packId, product_id: buy_product_id, is_free: false, position: 0 },
    { pack_id: packId, product_id: free_product_id, is_free: true, position: 1 },
  ]);
  if (itemsError) return { ok: false, error: 'saveFailed' };

  revalidatePath('/[locale]/admin/coupons', 'page');
  refresh();
  return OK;
}

export async function togglePackItem(_prev: AdminState, formData: FormData): Promise<AdminState> {
  const parsed = z
    .object({
      pack_id: z.string().uuid(),
      product_id: z.string().uuid(),
      // 'remove' takes the product out; 'paid' and 'free' put it in.
      mode: z.enum(['remove', 'paid', 'free']),
    })
    .safeParse({
      pack_id: formData.get('pack_id'),
      product_id: formData.get('product_id'),
      mode: formData.get('mode'),
    });
  if (!parsed.success) return { ok: false, error: 'invalid' };

  const supabase = await client();
  const { pack_id, product_id, mode } = parsed.data;

  if (mode === 'remove') {
    await supabase.from('pack_items').delete().eq('pack_id', pack_id).eq('product_id', product_id);
  } else {
    await supabase
      .from('pack_items')
      .upsert(
        { pack_id, product_id, is_free: mode === 'free' },
        { onConflict: 'pack_id,product_id' },
      );
  }

  revalidatePath('/[locale]/admin/packs', 'page');
  refresh();
  return OK;
}

// ---------------------------------------------------------------------------
// The programme — which modules a cursus covers, in which year and mode
// ---------------------------------------------------------------------------

/**
 * Tick or untick one cell of the programme grid.
 *
 * A plain form action rather than a `useActionState` one: the grid is a wall
 * of single-purpose buttons, and threading per-cell error state through it
 * would cost more than it tells anyone. A failure re-renders the grid with the
 * cell unchanged, which is the honest signal.
 */
export async function setProgrammeEntry(formData: FormData): Promise<void> {
  const parsed = z
    .object({
      cursus_id: z.string().uuid(),
      course_id: z.string().uuid(),
      delivery: z.enum(['presentiel', 'online']),
      year_index: z.coerce.number().int().min(1).max(10),
      included: z.enum(['yes', 'no']),
    })
    .safeParse({
      cursus_id: formData.get('cursus_id'),
      course_id: formData.get('course_id'),
      delivery: formData.get('delivery'),
      year_index: formData.get('year_index'),
      included: formData.get('included'),
    });
  if (!parsed.success) return;

  const supabase = await client();
  const { cursus_id, course_id, delivery, year_index, included } = parsed.data;

  if (included === 'no') {
    // Removing a module from a programme takes it away from everyone enrolled
    // in that year — `has_course_access` reads this table live.
    await supabase
      .from('cursus_courses')
      .delete()
      .eq('cursus_id', cursus_id)
      .eq('course_id', course_id)
      .eq('delivery', delivery)
      .eq('year_index', year_index);
  } else {
    await supabase
      .from('cursus_courses')
      .upsert(
        { cursus_id, course_id, delivery, year_index },
        { onConflict: 'cursus_id,course_id,delivery,year_index' },
      );
  }

  revalidatePath('/[locale]/admin/cursus', 'page');
  refresh();
}

const cursusSchema = z.object({
  id: z.string().uuid().optional(),
  slug: z
    .string()
    .min(2)
    .max(60)
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'slugShape'),
  kind: z.enum(['module', 'approfondi']),
  title: z.string().min(2).max(200),
  subtitle: z.string().max(300).default(''),
  description: z.string().max(4000).default(''),
  year_count: z.coerce.number().int().min(1).max(10).default(1),
  status: z.enum(['draft', 'published', 'archived']).default('draft'),
  display_order: z.coerce.number().int().min(0).max(9999).default(0),
});

export async function saveCursus(_prev: AdminState, formData: FormData): Promise<AdminState> {
  const parsed = cursusSchema.safeParse({
    id: (formData.get('id') as string) || undefined,
    slug: formData.get('slug'),
    kind: formData.get('kind'),
    title: formData.get('title'),
    subtitle: formData.get('subtitle') ?? '',
    description: formData.get('description') ?? '',
    year_count: formData.get('year_count') || 1,
    status: formData.get('status') ?? 'draft',
    display_order: formData.get('display_order') || 0,
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? 'invalid' };

  const supabase = await client();
  const { id, ...row } = parsed.data;
  const { error } = id
    ? await supabase.from('cursus').update(row).eq('id', id)
    : await supabase.from('cursus').insert(row);

  if (error) return { ok: false, error: error.code === '23505' ? 'slugTaken' : 'saveFailed' };

  revalidatePath('/[locale]/admin/cursus', 'page');
  refresh();
  return OK;
}

// ---------------------------------------------------------------------------
// Payment credentials
//
// The only thing in this file that uses the service role. `payment_settings`
// carries no grant for `authenticated` at all — deliberately, so that a stolen
// admin session cannot read the PayPal secret back out — which also means an
// admin's own session cannot write to it. The admin check is therefore done
// here, explicitly, rather than being left to a policy.
// ---------------------------------------------------------------------------

const paymentSchema = z.object({
  environment: z.enum(['sandbox', 'live']),
  client_id: z.string().max(200).default(''),
  merchant_email: z.string().max(254).default(''),
  currency: z
    .string()
    .regex(/^[A-Z]{3}$/, 'currencyShape')
    .default('EUR'),
  enabled: z.boolean().default(false),
});

export async function savePaymentSettings(
  _prev: AdminState,
  formData: FormData,
): Promise<AdminState> {
  if (!supabaseConfigured) return { ok: false, error: 'unavailable' };
  const admin = await requireAdmin();

  const parsed = paymentSchema.safeParse({
    environment: formData.get('environment'),
    client_id: String(formData.get('client_id') ?? '').trim(),
    merchant_email: String(formData.get('merchant_email') ?? '').trim(),
    currency: String(formData.get('currency') ?? 'EUR')
      .trim()
      .toUpperCase(),
    enabled: formData.get('enabled') === 'on',
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? 'invalid' };

  // Blank means "leave what is stored alone". Without this, opening the form
  // and pressing save would wipe the secret, because the field cannot be
  // pre-filled with it.
  const secret = String(formData.get('client_secret') ?? '').trim();
  const webhookId = String(formData.get('webhook_id') ?? '').trim();

  const supabase = createAdminClient();
  const { error } = await supabase
    .from('payment_settings')
    .update({
      ...parsed.data,
      ...(secret ? { client_secret: secret } : {}),
      ...(webhookId ? { webhook_id: webhookId } : {}),
      updated_by: admin.id,
    })
    .eq('id', true);

  if (error) {
    // The check constraint refuses `enabled` without credentials, which would
    // otherwise fail at the moment a student clicks pay.
    return { ok: false, error: error.code === '23514' ? 'credentialsMissing' : 'saveFailed' };
  }

  revalidatePath('/[locale]/admin/payments', 'page');
  return OK;
}
