'use server';

import { revalidatePath, revalidateTag } from 'next/cache';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { supabaseConfigured } from '@/lib/env';
import { requireStaff } from '@/lib/auth/guards';
import { checkImage } from '@/lib/media/image';
import { reportError } from '@/lib/observability/report';
import { EVENTS_TAG, REVIEWS_TAG, SITE_SETTINGS_TAG } from '@/lib/data/site';
import type { AdminState } from '@/app/actions/admin';

/**
 * The site's own content: the announcement strip, the social links, the
 * events and the testimonials.
 *
 * Every write goes through the ordinary anon-key client, so the `is_staff()`
 * policies are what decide — an authoring screen has no business bypassing the
 * rules it is authoring under.
 *
 * Each one ends by dropping the cache tag its table feeds. The public reads
 * are cached for an hour, which is right for a banner nobody is editing and
 * quite wrong the moment somebody is: without this, a saved change would sit
 * invisible while the office wondered whether the button had worked.
 */

const OK: AdminState = { ok: true };
const BUCKET = 'course-covers';

async function client() {
  if (!supabaseConfigured) throw new Error('unavailable');
  await requireStaff();
  return createClient();
}

/** Everything the public side of the site reads, refreshed at once. */
function refreshPublic() {
  revalidatePath('/', 'layout');
}

// ---------------------------------------------------------------------------
// Announcement and social links
// ---------------------------------------------------------------------------

const settingsSchema = z.object({
  announcement_text: z.string().trim().max(300).default(''),
  announcement_href: z.string().trim().max(500).default(''),
  announcement_enabled: z.preprocess((v) => v === 'on' || v === 'true' || v === true, z.boolean()),
  facebook: z.string().trim().max(300).default(''),
  instagram: z.string().trim().max(300).default(''),
  tiktok: z.string().trim().max(300).default(''),
  youtube: z.string().trim().max(300).default(''),
  whatsapp: z.string().trim().max(60).default(''),
});

export async function saveSiteSettings(_prev: AdminState, formData: FormData): Promise<AdminState> {
  const parsed = settingsSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: 'invalid' };

  const supabase = await client();
  const { error } = await supabase
    .from('site_settings')
    .update({ ...parsed.data, updated_at: new Date().toISOString() })
    .eq('id', true);

  if (error) {
    reportError('site.settings.save', error);
    return { ok: false, error: 'saveFailed' };
  }

  revalidateTag(SITE_SETTINGS_TAG);
  refreshPublic();
  return OK;
}

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------

const eventSchema = z.object({
  id: z.string().uuid().optional(),
  title: z.string().trim().min(2).max(200),
  title_ar: z.string().trim().max(200).default(''),
  excerpt: z.string().trim().max(500).default(''),
  body: z.string().trim().max(8000).default(''),
  location: z.string().trim().max(200).default(''),
  href: z.string().trim().max(500).default(''),
  // `datetime-local` posts "2026-09-20T18:30" with no zone. An empty box means
  // an announcement with no date, which is a real thing the school will want.
  starts_at: z
    .string()
    .trim()
    .transform((v) => (v === '' ? null : new Date(v).toISOString()))
    .nullable()
    .catch(null),
  display_order: z.coerce.number().int().min(0).max(9999).default(0),
});

export async function saveEvent(_prev: AdminState, formData: FormData): Promise<AdminState> {
  const parsed = eventSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: 'invalid' };

  const { id, ...fields } = parsed.data;
  const supabase = await client();

  const { error } = id
    ? await supabase
        .from('events')
        .update({ ...fields, updated_at: new Date().toISOString() })
        .eq('id', id)
    : await supabase.from('events').insert(fields);

  if (error) {
    reportError('site.event.save', error);
    return { ok: false, error: 'saveFailed' };
  }

  revalidateTag(EVENTS_TAG);
  revalidatePath('/[locale]/admin/site', 'page');
  refreshPublic();
  return OK;
}

export async function setEventStatus(_prev: AdminState, formData: FormData): Promise<AdminState> {
  const parsed = z
    .object({ id: z.string().uuid(), status: z.enum(['draft', 'published', 'archived']) })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: 'invalid' };

  const supabase = await client();
  const { error } = await supabase
    .from('events')
    .update({ status: parsed.data.status, updated_at: new Date().toISOString() })
    .eq('id', parsed.data.id);
  if (error) return { ok: false, error: 'saveFailed' };

  revalidateTag(EVENTS_TAG);
  revalidatePath('/[locale]/admin/site', 'page');
  refreshPublic();
  return OK;
}

export async function deleteEvent(_prev: AdminState, formData: FormData): Promise<AdminState> {
  const id = z.string().uuid().safeParse(formData.get('id'));
  if (!id.success) return { ok: false, error: 'invalid' };

  const supabase = await client();
  const { error } = await supabase.from('events').delete().eq('id', id.data);
  if (error) return { ok: false, error: 'saveFailed' };

  revalidateTag(EVENTS_TAG);
  revalidatePath('/[locale]/admin/site', 'page');
  refreshPublic();
  return OK;
}

/**
 * The picture on an event card.
 *
 * Validated by its BYTES before a single one reaches storage, through the same
 * `checkImage` the course cover uses — a declared content-type is a claim, not
 * a fact.
 */
export async function uploadEventImage(_prev: AdminState, formData: FormData): Promise<AdminState> {
  const id = z.string().uuid().safeParse(formData.get('id'));
  const file = formData.get('file');
  if (!id.success) return { ok: false, error: 'invalid' };
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: 'noFile' };

  const bytes = new Uint8Array(await file.arrayBuffer());
  const check = checkImage(bytes);
  if (!check.ok) return { ok: false, error: check.error };

  const supabase = await client();
  const path = `events/${id.data}-${Date.now()}.${check.extension}`;
  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(path, bytes, { contentType: check.contentType, upsert: true });
  if (uploadError) {
    reportError('site.event.upload', uploadError, { id: id.data });
    return { ok: false, error: 'uploadFailed' };
  }

  const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path);
  const { error } = await supabase
    .from('events')
    .update({ image_url: pub.publicUrl, updated_at: new Date().toISOString() })
    .eq('id', id.data);
  if (error) return { ok: false, error: 'saveFailed' };

  revalidateTag(EVENTS_TAG);
  revalidatePath('/[locale]/admin/site', 'page');
  refreshPublic();
  return OK;
}

// ---------------------------------------------------------------------------
// Reviews
// ---------------------------------------------------------------------------

const reviewSchema = z.object({
  id: z.string().uuid().optional(),
  author_name: z.string().trim().min(2).max(120),
  author_context: z.string().trim().max(200).default(''),
  quote: z.string().trim().min(10).max(1200),
  rating: z.coerce.number().int().min(1).max(5).default(5),
  display_order: z.coerce.number().int().min(0).max(9999).default(0),
});

export async function saveReview(_prev: AdminState, formData: FormData): Promise<AdminState> {
  const parsed = reviewSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: 'invalid' };

  const { id, ...fields } = parsed.data;
  const supabase = await client();

  const { error } = id
    ? await supabase
        .from('reviews')
        .update({ ...fields, updated_at: new Date().toISOString() })
        .eq('id', id)
    : await supabase.from('reviews').insert(fields);

  if (error) {
    reportError('site.review.save', error);
    return { ok: false, error: 'saveFailed' };
  }

  revalidateTag(REVIEWS_TAG);
  revalidatePath('/[locale]/admin/site', 'page');
  refreshPublic();
  return OK;
}

export async function setReviewStatus(_prev: AdminState, formData: FormData): Promise<AdminState> {
  const parsed = z
    .object({ id: z.string().uuid(), status: z.enum(['draft', 'published', 'archived']) })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: 'invalid' };

  const supabase = await client();
  const { error } = await supabase
    .from('reviews')
    .update({ status: parsed.data.status, updated_at: new Date().toISOString() })
    .eq('id', parsed.data.id);
  if (error) return { ok: false, error: 'saveFailed' };

  revalidateTag(REVIEWS_TAG);
  revalidatePath('/[locale]/admin/site', 'page');
  refreshPublic();
  return OK;
}

export async function deleteReview(_prev: AdminState, formData: FormData): Promise<AdminState> {
  const id = z.string().uuid().safeParse(formData.get('id'));
  if (!id.success) return { ok: false, error: 'invalid' };

  const supabase = await client();
  const { error } = await supabase.from('reviews').delete().eq('id', id.data);
  if (error) return { ok: false, error: 'saveFailed' };

  revalidateTag(REVIEWS_TAG);
  revalidatePath('/[locale]/admin/site', 'page');
  refreshPublic();
  return OK;
}

// ---------------------------------------------------------------------------
// Contact messages
// ---------------------------------------------------------------------------

/**
 * Mark a message dealt with, or put it back.
 *
 * Never a delete: a question that has been answered is still a record of
 * having been asked, and the office may well need to find it again.
 */
export async function setMessageHandled(
  _prev: AdminState,
  formData: FormData,
): Promise<AdminState> {
  const parsed = z
    .object({ id: z.string().uuid(), handled: z.enum(['yes', 'no']) })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: 'invalid' };

  const supabase = await client();
  const { error } = await supabase
    .from('contact_messages')
    .update({ handled_at: parsed.data.handled === 'yes' ? new Date().toISOString() : null })
    .eq('id', parsed.data.id);
  if (error) return { ok: false, error: 'saveFailed' };

  revalidatePath('/[locale]/admin/site', 'page');
  return OK;
}
