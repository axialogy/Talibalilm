'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { supabaseConfigured } from '@/lib/env';
import { requireStaff } from '@/lib/auth/guards';
import { checkImage, MAX_IMAGE_BYTES } from '@/lib/media/image';
import { isSlideKeyFor, safeFilename, slideKey, slideName } from '@/lib/storage/key';
import {
  deleteSlideObject,
  r2Configured,
  readSlideHead,
  signSlideDownload,
  signSlideUpload,
} from '@/lib/storage/r2';
import { reportError } from '@/lib/observability/report';
import type { AdminState } from '@/app/actions/admin';

/**
 * Slides for a live class.
 *
 * Upload is two steps on purpose:
 *
 *   1. `requestSlideUpload` checks the caller is staff, that the class exists,
 *      and that the deck has room — then signs a URL for one object, whose key
 *      it chooses. The browser PUTs the file straight to Cloudflare.
 *   2. `confirmSlide` reads the first bytes back out of the bucket and sniffs
 *      them. Only an actual PNG, JPEG or WebP becomes a row; anything else is
 *      deleted from the bucket and refused.
 *
 * The second step is what keeps the codebase's oldest rule intact — a file is
 * judged by its bytes, never by the content type a browser claims — without
 * streaming every slide through a Vercel function to do it. An object with no
 * row is invisible to every read path in the app, so a failed confirm leaves
 * nothing reachable behind even if the delete also fails.
 *
 * Nothing here takes a bucket key on trust. `isSlideKeyFor` rejects a key that
 * is not this session's before any call to R2, and the table's own CHECK
 * refuses the same thing independently.
 */

const OK: AdminState = { ok: true };
const MAX_SLIDES = 200;

async function staffClient() {
  if (!supabaseConfigured) throw new Error('unavailable');
  await requireStaff();
  return createClient();
}

export interface UploadTicket extends AdminState {
  /** Where the browser PUTs the file. Valid for a few minutes, for this key only. */
  url?: string;
  key?: string;
  contentType?: string;
}

const requestSchema = z.object({
  sessionId: z.string().uuid(),
  // The declared type decides the extension only. It is not believed: the bytes
  // are read back in `confirmSlide` before the slide exists.
  contentType: z.enum(['image/png', 'image/jpeg', 'image/webp']),
  byteSize: z.coerce.number().int().min(1).max(MAX_IMAGE_BYTES),
});

export async function requestSlideUpload(input: {
  sessionId: string;
  contentType: string;
  byteSize: number;
}): Promise<UploadTicket> {
  if (!r2Configured) return { ok: false, error: 'storageUnavailable' };

  const parsed = requestSchema.safeParse(input);
  if (!parsed.success) {
    // A size over the cap is the one case worth naming: the teacher can act on it.
    const tooBig = parsed.error.issues.some((i) => i.path[0] === 'byteSize');
    return { ok: false, error: tooBig ? 'tooLarge' : 'notAnImage' };
  }

  const supabase = await staffClient();

  // The class must exist and be one this staff member can see. Read through the
  // ordinary client so the policy is the check, not a condition written here.
  const { data: session } = await supabase
    .from('live_sessions')
    .select('id, status')
    .eq('id', parsed.data.sessionId)
    .maybeSingle();
  if (!session) return { ok: false, error: 'sessionNotFound' };

  const { count } = await supabase
    .from('live_slides')
    .select('id', { count: 'exact', head: true })
    .eq('session_id', parsed.data.sessionId);
  if ((count ?? 0) >= MAX_SLIDES) return { ok: false, error: 'deckFull' };

  const extension =
    parsed.data.contentType === 'image/png'
      ? 'png'
      : parsed.data.contentType === 'image/webp'
        ? 'webp'
        : 'jpg';
  const key = slideKey(parsed.data.sessionId, extension, slideName());
  const url = await signSlideUpload(key, parsed.data.contentType);
  if (!url) return { ok: false, error: 'storageUnavailable' };

  return { ok: true, url, key, contentType: parsed.data.contentType };
}

const confirmSchema = z.object({
  sessionId: z.string().uuid(),
  key: z.string().max(300),
  filename: z.string().max(300).default(''),
});

export async function confirmSlide(input: {
  sessionId: string;
  key: string;
  filename: string;
}): Promise<AdminState> {
  if (!r2Configured) return { ok: false, error: 'storageUnavailable' };

  const parsed = confirmSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'invalid' };
  const { sessionId, key, filename } = parsed.data;

  // Before anything reaches the bucket: is this a key we would have issued for
  // this class? A caller naming another class's object stops here.
  if (!isSlideKeyFor(key, sessionId)) return { ok: false, error: 'invalid' };

  const supabase = await staffClient();

  // What was actually uploaded, judged by its leading bytes and its real
  // length. A file that only claims to be an image, or that is larger than the
  // ticket allowed for, is removed rather than left sitting in the bucket.
  const object = await readSlideHead(key);
  if (!object) return { ok: false, error: 'uploadFailed' };

  if (object.size > MAX_IMAGE_BYTES) {
    await deleteSlideObject(key);
    return { ok: false, error: 'tooLarge' };
  }
  const check = checkImage(object.head);
  if (!check.ok) {
    await deleteSlideObject(key);
    return { ok: false, error: check.error };
  }

  const { data: last } = await supabase
    .from('live_slides')
    .select('display_order')
    .eq('session_id', sessionId)
    .order('display_order', { ascending: false })
    .limit(1)
    .maybeSingle();

  const { error } = await supabase.from('live_slides').insert({
    session_id: sessionId,
    storage_key: key,
    filename: safeFilename(filename),
    mime_type: check.contentType,
    byte_size: object.size,
    display_order: (last?.display_order ?? -1) + 1,
  });
  if (error) {
    reportError('slides.insert', error, { sessionId });
    await deleteSlideObject(key);
    return { ok: false, error: 'saveFailed' };
  }

  revalidatePath('/[locale]/admin/live/[id]', 'page');
  return OK;
}

export async function deleteSlide(_prev: AdminState, formData: FormData): Promise<AdminState> {
  const parsed = z
    .object({ id: z.string().uuid(), sessionId: z.string().uuid() })
    .safeParse({ id: formData.get('id'), sessionId: formData.get('sessionId') });
  if (!parsed.success) return { ok: false, error: 'invalid' };

  const supabase = await staffClient();

  // Read the key back through the policy rather than taking it from the form:
  // the row is what says which object this slide owns.
  const { data: slide } = await supabase
    .from('live_slides')
    .select('storage_key, session_id')
    .eq('id', parsed.data.id)
    .maybeSingle();
  if (!slide || slide.session_id !== parsed.data.sessionId) {
    return { ok: false, error: 'invalid' };
  }

  const { error } = await supabase.from('live_slides').delete().eq('id', parsed.data.id);
  if (error) return { ok: false, error: 'saveFailed' };

  // The row is gone, so the slide is already unreachable; a bucket object that
  // outlives its row is waste, not an exposure, and a failed delete is logged
  // rather than shown to the teacher as a failure to remove the slide.
  await deleteSlideObject(slide.storage_key);

  revalidatePath('/[locale]/admin/live/[id]', 'page');
  return OK;
}

/** Move one slide up or down the deck, swapping with its neighbour. */
export async function moveSlide(_prev: AdminState, formData: FormData): Promise<AdminState> {
  const parsed = z
    .object({
      id: z.string().uuid(),
      sessionId: z.string().uuid(),
      direction: z.enum(['up', 'down']),
    })
    .safeParse({
      id: formData.get('id'),
      sessionId: formData.get('sessionId'),
      direction: formData.get('direction'),
    });
  if (!parsed.success) return { ok: false, error: 'invalid' };

  const supabase = await staffClient();
  const { data: deck } = await supabase
    .from('live_slides')
    .select('id, display_order')
    .eq('session_id', parsed.data.sessionId)
    .order('display_order');
  if (!deck) return { ok: false, error: 'saveFailed' };

  const at = deck.findIndex((s) => s.id === parsed.data.id);
  const to = parsed.data.direction === 'up' ? at - 1 : at + 1;
  if (at < 0 || to < 0 || to >= deck.length) return OK; // Already at the end.

  // Swap the two orders. Two updates rather than a renumber of the whole deck:
  // the pair is what changed, and `display_order` carries no uniqueness that a
  // transient collision could violate.
  const a = deck[at];
  const b = deck[to];
  if (!a || !b) return OK;
  const { error } = await supabase
    .from('live_slides')
    .update({ display_order: b.display_order })
    .eq('id', a.id);
  if (error) return { ok: false, error: 'saveFailed' };
  await supabase.from('live_slides').update({ display_order: a.display_order }).eq('id', b.id);

  revalidatePath('/[locale]/admin/live/[id]', 'page');
  return OK;
}

/**
 * A signed link to one slide, for whoever is allowed to see it.
 *
 * `can_read_slide()` answers from the key alone, inside the database, so a
 * student cannot pass a session id that disagrees with the object they want.
 * Staff and entitled students get a URL; everyone else gets null, key in hand
 * or not.
 */
export async function slideUrl(key: string): Promise<string | null> {
  if (!supabaseConfigured || !r2Configured) return null;
  const supabase = await createClient();
  const { data: allowed, error } = await supabase.rpc('can_read_slide', { key });
  if (error) {
    reportError('slides.authorize', error);
    return null;
  }
  if (!allowed) return null;
  return signSlideDownload(key);
}
