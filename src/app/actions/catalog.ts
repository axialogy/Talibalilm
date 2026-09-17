'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { supabaseConfigured } from '@/lib/env';
import { requireAdmin, requireStaff } from '@/lib/auth/guards';
import type { AdminState } from '@/app/actions/admin';
import { errorDetail } from '@/lib/supabase/error-detail';
import { reportError } from '@/lib/observability/report';
import { checkImage } from '@/lib/media/image';
import { stepUpUnlocked } from '@/lib/security/stepup-server';
import { signRevertToken } from '@/lib/security/pin';
import { notifyStaff } from '@/lib/push/server';
import { sendMail, officeInbox } from '@/lib/email/send';
import { securityAlert } from '@/lib/email/templates';
import { institut } from '@/lib/content/institut';
import { siteUrl } from '@/lib/env';
import { pickFreeSlug, slugify } from '@/lib/content/slug';

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

/** The public media bucket: course covers, event images, cursus posters. */
const BUCKET = 'course-covers';

async function client() {
  if (!supabaseConfigured) throw new Error('unavailable');
  await requireStaff();
  return createClient();
}

function refresh() {
  revalidatePath('/[locale]/admin/courses/[id]', 'page');
  revalidatePath('/[locale]/admin/cursus', 'page');
  revalidatePath('/[locale]', 'page');
  revalidatePath('/[locale]/checkout', 'page');
}

// ---------------------------------------------------------------------------
/**
 * Remove a course, or refuse and say why.
 *
 * Deleting a course is far more destructive than it looks. `products.course_id`
 * cascades, so its prices go with it; `order_items.product_id` is `on delete
 * restrict`, so the database would block that the moment anything was ever
 * sold; and `entitlements.course_id` cascades too, which means a delete that
 * DID succeed would erase the record of what students are entitled to.
 *
 * So this refuses in every case where something would be lost, and names the
 * reason. Archiving is the answer for a course with history: it leaves the
 * catalogue without touching a single sale.
 */
export async function deleteCourse(_prev: AdminState, formData: FormData): Promise<AdminState> {
  const id = z.string().uuid().safeParse(formData.get('id'));
  if (!id.success) return { ok: false, error: 'invalid' };

  const supabase = await client();

  const { data: products } = await supabase.from('products').select('id').eq('course_id', id.data);
  const productIds = (products ?? []).map((p) => p.id);

  if (productIds.length > 0) {
    const [{ count: sold }, { count: inPacks }] = await Promise.all([
      supabase
        .from('order_items')
        .select('id', { count: 'exact', head: true })
        .in('product_id', productIds),
      supabase
        .from('pack_items')
        .select('product_id', { count: 'exact', head: true })
        .in('product_id', productIds),
    ]);
    if ((sold ?? 0) > 0) return { ok: false, error: 'courseSold' };
    if ((inPacks ?? 0) > 0) return { ok: false, error: 'courseInBonus' };
  }

  // Even without a sale, someone may hold a manual grant for it.
  const { count: granted } = await supabase
    .from('entitlements')
    .select('id', { count: 'exact', head: true })
    .eq('course_id', id.data);
  if ((granted ?? 0) > 0) return { ok: false, error: 'courseGranted' };

  const { error } = await supabase.from('courses').delete().eq('id', id.data);
  if (error) return { ok: false, error: 'saveFailed', detail: errorDetail(error) };

  revalidatePath('/[locale]/admin/courses', 'page');
  refresh();
  return OK;
}

/**
 * Remove a cursus.
 *
 * Every foreign key pointing at a cursus cascades — its programme rows, its
 * products, and, crucially, the entitlements students hold for it. A plain
 * DELETE would therefore take paid access away without a word, so the same
 * pre-checks as a course apply: anything sold, offered as a bonus, or granted
 * by hand blocks the delete and the admin is told which, in words. Archiving
 * from the form is the way to retire one that has history.
 */
export async function deleteCursus(_prev: AdminState, formData: FormData): Promise<AdminState> {
  const id = z.string().uuid().safeParse(formData.get('id'));
  if (!id.success) return { ok: false, error: 'invalid' };

  const supabase = await client();

  const { data: products } = await supabase.from('products').select('id').eq('cursus_id', id.data);
  const productIds = (products ?? []).map((p) => p.id);

  if (productIds.length > 0) {
    const [{ count: sold }, { count: inPacks }] = await Promise.all([
      supabase
        .from('order_items')
        .select('id', { count: 'exact', head: true })
        .in('product_id', productIds),
      supabase
        .from('pack_items')
        .select('product_id', { count: 'exact', head: true })
        .in('product_id', productIds),
    ]);
    if ((sold ?? 0) > 0) return { ok: false, error: 'cursusSold' };
    if ((inPacks ?? 0) > 0) return { ok: false, error: 'cursusInBonus' };
  }

  const { count: granted } = await supabase
    .from('entitlements')
    .select('id', { count: 'exact', head: true })
    .eq('cursus_id', id.data);
  if ((granted ?? 0) > 0) return { ok: false, error: 'cursusGranted' };

  const { error } = await supabase.from('cursus').delete().eq('id', id.data);
  if (error) return { ok: false, error: 'saveFailed', detail: errorDetail(error) };

  revalidatePath('/[locale]/admin/cursus', 'page');
  refresh();
  return OK;
}

/** Take a course out of the catalogue while leaving every sale intact. */
export async function archiveCourse(_prev: AdminState, formData: FormData): Promise<AdminState> {
  const parsed = z
    .object({ id: z.string().uuid(), status: z.enum(['archived', 'draft']) })
    .safeParse({ id: formData.get('id'), status: formData.get('status') ?? 'archived' });
  if (!parsed.success) return { ok: false, error: 'invalid' };

  const supabase = await client();
  const { error } = await supabase
    .from('courses')
    .update({ status: parsed.data.status })
    .eq('id', parsed.data.id);
  if (error) return { ok: false, error: 'saveFailed', detail: errorDetail(error) };

  revalidatePath('/[locale]/admin/courses', 'page');
  refresh();
  return OK;
}

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
      hours_per_week:
        hoursWeek === '' ? null : Math.round(Number(hoursWeek.replace(',', '.')) * 10),
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
  if (error)
    return {
      ok: false,
      error: error.code === '23503' ? 'productSold' : 'saveFailed',
      detail: errorDetail(error),
    };

  refresh();
  return OK;
}

// ---------------------------------------------------------------------------
// Bonuses
//
// A bonus is a `packs` row carrying exactly one paid item and one free one.
// The general-purpose Offers screen that used to write arbitrary packs is gone
// — the school only ever sells "buy this, get that" — so the only writer left
// is `saveBonus`, which builds that shape and nothing else.
// ---------------------------------------------------------------------------

export async function deletePack(_prev: AdminState, formData: FormData): Promise<AdminState> {
  const id = z.string().uuid().safeParse(formData.get('id'));
  if (!id.success) return { ok: false, error: 'invalid' };

  const supabase = await client();
  await supabase.from('packs').delete().eq('id', id.data);
  revalidatePath('/[locale]/admin/coupons', 'page');
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
      /** A MODULE, not a product: the mode is taken from the paid half. */
      free_course_id: z.string().uuid(),
      status: z.enum(['draft', 'published', 'archived']).default('published'),
      max_redemptions: z.coerce.number().int().min(1).max(100_000).nullable().default(null),
    })
    .safeParse({
      id: (formData.get('id') as string) || undefined,
      buy_product_id: formData.get('buy_product_id'),
      free_course_id: formData.get('free_course_id'),
      status: formData.get('status') ?? 'published',
      max_redemptions: String(formData.get('max_redemptions') ?? '').trim() || null,
    });
  if (!parsed.success) return { ok: false, error: 'invalid' };

  const { id, buy_product_id, free_course_id, status, max_redemptions } = parsed.data;

  const supabase = await client();

  // The office picks a PAID PRODUCT (a module in one mode) and a FREE MODULE,
  // with no mode of its own. The mode of the gift is then this one's, resolved
  // below — and that is not a shortcut, it is the only shape that works:
  //
  //   * A basket is one delivery mode from end to end. `priceSelection` takes a
  //     single `delivery`, `bestPack` filters packs by it, and a `sum` pack
  //     zeroes a line ALREADY IN the basket. A gift from the other mode could
  //     never appear there to be zeroed.
  //   * And it would buy nothing anyway. An entitlement carries `course_id`;
  //     access is to the COURSE. "Buy Quran online, get Quran on site free"
  //     grants a course the student already has.
  //
  // So the office chooses which module is thrown in, we find that module's
  // product in the mode being bought, and the old "both must be the same mode"
  // refusal disappears because the question is no longer asked.
  const { data: buyRows } = await supabase
    .from('products')
    .select('id, delivery, course_id, cursus_id, courses ( title ), cursus ( title )')
    .eq('id', buy_product_id);
  const buy = buyRows?.[0];
  if (!buy) return { ok: false, error: 'invalid' };

  if (buy.course_id === free_course_id) return { ok: false, error: 'bonusSameProduct' };

  const { data: giftRows } = await supabase
    .from('products')
    .select('id, delivery, course_id, cursus_id, courses ( title ), cursus ( title )')
    .eq('course_id', free_course_id)
    .eq('kind', 'module')
    .eq('delivery', buy.delivery)
    .eq('status', 'published')
    .limit(1);
  const gift = giftRows?.[0];
  // The module exists but has no published price in the mode being bought, so
  // there is nothing to give away. Said precisely rather than as "invalid".
  if (!gift) return { ok: false, error: 'bonusGiftNotSoldInThisMode' };

  const free_product_id = gift.id;

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
    if (error) return { ok: false, error: 'saveFailed', detail: errorDetail(error) };
    // Replace the items rather than diffing: a bonus is exactly two.
    await supabase.from('pack_items').delete().eq('pack_id', packId);
  } else {
    const slug = `bonus-${Math.random().toString(36).slice(2, 10)}`;
    const { data: created, error } = await supabase
      .from('packs')
      .insert({ ...row, slug })
      .select('id')
      .single();
    if (error || !created) return { ok: false, error: 'saveFailed', detail: errorDetail(error) };
    packId = created.id;
  }

  const { error: itemsError } = await supabase.from('pack_items').insert([
    { pack_id: packId, product_id: buy_product_id, is_free: false, position: 0 },
    { pack_id: packId, product_id: free_product_id, is_free: true, position: 1 },
  ]);
  if (itemsError) return { ok: false, error: 'saveFailed', detail: errorDetail(itemsError) };

  revalidatePath('/[locale]/admin/coupons', 'page');
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

/**
 * Tick or untick a module's membership of a cursus year, BOTH modes at once.
 *
 * `cursus_courses` keys on delivery as well as year, so the old grid drew two
 * checkboxes per year — "Année 1 · en ligne" beside "Année 1 · présentiel" —
 * and the teacher ticked both every single time. The school does not teach a
 * module in one mode and not the other; it teaches the module, and the student
 * picks how they attend. So the unit of the decision is the YEAR, and the two
 * rows are maintained together beneath it.
 *
 * `setProgrammeEntry` above is still there for the cursus screen's grid, where
 * per-mode control is occasionally the point.
 */
export async function setCursusYear(formData: FormData): Promise<void> {
  const parsed = z
    .object({
      cursus_id: z.string().uuid(),
      course_id: z.string().uuid(),
      year_index: z.coerce.number().int().min(1).max(10),
      included: z.enum(['yes', 'no']),
    })
    .safeParse({
      cursus_id: formData.get('cursus_id'),
      course_id: formData.get('course_id'),
      year_index: formData.get('year_index'),
      included: formData.get('included'),
    });
  if (!parsed.success) return;

  const supabase = await client();
  const { cursus_id, course_id, year_index, included } = parsed.data;
  const modes = ['presentiel', 'online'] as const;

  if (included === 'no') {
    await supabase
      .from('cursus_courses')
      .delete()
      .eq('cursus_id', cursus_id)
      .eq('course_id', course_id)
      .eq('year_index', year_index);
  } else {
    await supabase.from('cursus_courses').upsert(
      modes.map((delivery) => ({ cursus_id, course_id, delivery, year_index })),
      { onConflict: 'cursus_id,course_id,delivery,year_index' },
    );
  }

  revalidatePath('/[locale]/admin/cursus', 'page');
  revalidatePath('/[locale]/admin/courses/[id]', 'page');
  refresh();
}

const cursusSchema = z.object({
  id: z.string().uuid().optional(),
  kind: z.enum(['module', 'approfondi']),
  title: z.string().min(2).max(200),
  subtitle: z.string().max(300).default(''),
  description: z.string().max(4000).default(''),
  /**
   * The written programme shown in the "Voir le cursus" accordion on the home
   * page. One entry per line; the card keeps the line breaks.
   */
  details: z.string().max(8000).default(''),
  year_count: z.coerce.number().int().min(1).max(10).default(1),
  status: z.enum(['draft', 'published', 'archived']).default('draft'),
  display_order: z.coerce.number().int().min(0).max(9999).default(0),
});

export async function saveCursus(_prev: AdminState, formData: FormData): Promise<AdminState> {
  const parsed = cursusSchema.safeParse({
    id: (formData.get('id') as string) || undefined,
    kind: formData.get('kind'),
    title: formData.get('title'),
    subtitle: formData.get('subtitle') ?? '',
    description: formData.get('description') ?? '',
    details: formData.get('details') ?? '',
    year_count: formData.get('year_count') || 1,
    status: formData.get('status') ?? 'draft',
    display_order: formData.get('display_order') || 0,
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? 'invalid' };

  const supabase = await client();
  const { id, ...row } = parsed.data;

  let error;
  if (id) {
    // The address is settled when the cursus is created and kept afterwards,
    // so renaming it does not break the links students already hold.
    ({ error } = await supabase.from('cursus').update(row).eq('id', id));
  } else {
    const base = slugify(row.title, 52);
    const { data: siblings } = await supabase
      .from('cursus')
      .select('slug')
      .like('slug', `${base || 'cursus'}%`);
    const slug = pickFreeSlug(
      base,
      (siblings ?? []).map((r) => r.slug),
      'cursus',
    );
    ({ error } = await supabase.from('cursus').insert({ ...row, slug }));
  }

  if (error)
    return {
      ok: false,
      error: error.code === '23505' ? 'slugTaken' : 'saveFailed',
      detail: errorDetail(error),
    };

  revalidatePath('/[locale]/admin/cursus', 'page');
  refresh();
  return OK;
}

/**
 * The programme poster for one cursus.
 *
 * Same shape as an event image: the bytes are checked before anything is
 * stored, the file goes to the public course-media bucket, and the row keeps
 * the resulting URL. The home page shows it inside the "Voir le cursus"
 * accordion, so the refresh below is what makes a new poster appear.
 */
export async function uploadCursusImage(
  _prev: AdminState,
  formData: FormData,
): Promise<AdminState> {
  const id = z.string().uuid().safeParse(formData.get('id'));
  const file = formData.get('file');
  if (!id.success) return { ok: false, error: 'invalid' };
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: 'noFile' };

  const bytes = new Uint8Array(await file.arrayBuffer());
  const check = checkImage(bytes);
  if (!check.ok) return { ok: false, error: check.error };

  const supabase = await client();
  const path = `cursus/${id.data}-${Date.now()}.${check.extension}`;
  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(path, bytes, { contentType: check.contentType, upsert: true });
  if (uploadError) {
    reportError('catalog.cursus.image.upload', uploadError, { id: id.data });
    return { ok: false, error: 'uploadFailed', detail: errorDetail(uploadError) };
  }

  const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path);
  const { error } = await supabase
    .from('cursus')
    .update({ image_url: pub.publicUrl })
    .eq('id', id.data);
  if (error) return { ok: false, error: 'saveFailed', detail: errorDetail(error) };

  revalidatePath('/[locale]/admin/cursus', 'page');
  refresh();
  return OK;
}

export async function removeCursusImage(
  _prev: AdminState,
  formData: FormData,
): Promise<AdminState> {
  const id = z.string().uuid().safeParse(formData.get('id'));
  if (!id.success) return { ok: false, error: 'invalid' };

  const supabase = await client();
  const { error } = await supabase
    .from('cursus')
    .update({ image_url: null })
    .eq('id', id.data);
  if (error) return { ok: false, error: 'saveFailed', detail: errorDetail(error) };

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

  // The page hides the form without the PIN; this is the check that counts.
  // A hand-posted request has no step-up cookie.
  if (!(await stepUpUnlocked())) return { ok: false, error: 'locked' };

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

  // What it was, for the alert: an admin who did not make this change has to
  // be told WHAT changed, in words, without any secret in the message.
  const { data: before } = await supabase
    .from('payment_settings')
    .select('environment, client_id, merchant_email, currency, enabled, client_secret, webhook_id')
    .eq('id', true)
    .maybeSingle();

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

  await alertPaymentChange({
    actorId: admin.id,
    actorEmail: admin.email ?? '',
    before: before ?? null,
    after: {
      environment: parsed.data.environment,
      client_id: parsed.data.client_id,
      merchant_email: parsed.data.merchant_email,
      currency: parsed.data.currency,
      enabled: parsed.data.enabled,
      client_secret: secret ? 'replaced' : (before?.client_secret ? 'kept' : 'set'),
      webhook_id: webhookId ? 'replaced' : (before?.webhook_id ? 'kept' : 'set'),
    },
  });

  revalidatePath('/[locale]/admin/payments', 'page');
  return OK;
}

/**
 * Tell every admin the PayPal account was touched.
 *
 * The e-mail carries a one-click "it was not me" link: it clears the
 * credentials and switches online payment off immediately, then asks the
 * account holder to change their password. Clearing rather than restoring the
 * previous values is deliberate — the previous values are exactly what an
 * attacker would be trying to move the money away from.
 */
async function alertPaymentChange(input: {
  actorId: string;
  actorEmail: string;
  before: Record<string, unknown> | null;
  after: Record<string, unknown>;
}): Promise<void> {
  const secret = process.env.STEPUP_SECRET?.trim();
  const changedAt = Date.now();
  const token = secret ? signRevertToken(input.actorId, changedAt, secret) : null;
  const revertUrl = token
    ? `${siteUrl()}/api/security/paypal-revert?u=${input.actorId}&t=${encodeURIComponent(token)}`
    : null;

  const changed = Object.keys(input.after).filter((key) => {
    const was = input.before ? input.before[key] : undefined;
    return String(was ?? '') !== String(input.after[key] ?? '');
  });

  const summary = changed
    .map((key) => `${key}: ${input.before ? String(input.before[key] ?? '—') : '—'} → ${String(input.after[key] ?? '—')}`)
    .join('\n');

  try {
    await sendMail(
      securityAlert({
        to: officeInbox(institut.email),
        action: 'Configuration PayPal modifiée',
        actor: input.actorEmail || input.actorId,
        detail: summary || 'aucun champ modifié',
        revertUrl,
      }),
    );
  } catch (cause) {
    reportError('security.paypal.alert.mail', cause, { actorId: input.actorId });
  }

  try {
    await notifyStaff({
      title: 'Configuration PayPal modifiée',
      body: `${input.actorEmail || 'Un administrateur'} a modifié les identifiants PayPal. Si ce n’est pas vous, ouvrez l’e-mail d’alerte et cliquez « Ce n’était pas moi ».`,
      url: '/admin/payments',
      tag: `paypal-change-${changedAt}`,
    });
  } catch (cause) {
    reportError('security.paypal.alert.push', cause, { actorId: input.actorId });
  }
}
