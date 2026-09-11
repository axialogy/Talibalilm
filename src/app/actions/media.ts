'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { supabaseConfigured } from '@/lib/env';
import { requireStaff } from '@/lib/auth/guards';
import { checkImage } from '@/lib/media/image';
import { reportError } from '@/lib/observability/report';
import type { AdminState } from '@/app/actions/admin';

/**
 * Course cover uploads.
 *
 * The file is validated by its BYTES, never its declared content-type, before
 * a single byte reaches storage — see `checkImage`. The upload goes through the
 * ordinary staff session, so the storage policy (`is_staff()`) is the gate, and
 * the public URL is written back to `courses.cover_url` through the same
 * staff-write policy the rest of the editor uses.
 */

const BUCKET = 'course-covers';
const OK: AdminState = { ok: true };

export async function uploadCourseCover(_prev: AdminState, formData: FormData): Promise<AdminState> {
  if (!supabaseConfigured) return { ok: false, error: 'unavailable' };
  await requireStaff();

  const courseId = z.string().uuid().safeParse(formData.get('courseId'));
  const file = formData.get('file');
  if (!courseId.success) return { ok: false, error: 'invalid' };
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: 'noFile' };

  const bytes = new Uint8Array(await file.arrayBuffer());
  const check = checkImage(bytes);
  if (!check.ok) return { ok: false, error: check.error };

  const supabase = await createClient();
  const path = `${courseId.data}/cover-${Date.now()}.${check.extension}`;

  const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, bytes, {
    contentType: check.contentType,
    upsert: true,
  });
  if (uploadError) {
    reportError('media.upload', uploadError, { courseId: courseId.data });
    return { ok: false, error: 'uploadFailed' };
  }

  const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path);

  const { error: updateError } = await supabase
    .from('courses')
    .update({ cover_url: pub.publicUrl })
    .eq('id', courseId.data);
  if (updateError) {
    reportError('media.setCover', updateError, { courseId: courseId.data });
    return { ok: false, error: 'saveFailed' };
  }

  revalidatePath('/[locale]/admin/courses/[id]', 'page');
  revalidatePath('/[locale]/(site)/courses/[slug]', 'page');
  return OK;
}

export async function removeCourseCover(_prev: AdminState, formData: FormData): Promise<AdminState> {
  if (!supabaseConfigured) return { ok: false, error: 'unavailable' };
  await requireStaff();

  const courseId = z.string().uuid().safeParse(formData.get('courseId'));
  if (!courseId.success) return { ok: false, error: 'invalid' };

  const supabase = await createClient();
  // Clears the reference; the drawn placeholder takes over again. The object is
  // left in the bucket rather than orphan-hunted here — cheap, and a later
  // sweep can prune covers no course points at.
  const { error } = await supabase
    .from('courses')
    .update({ cover_url: null })
    .eq('id', courseId.data);
  if (error) return { ok: false, error: 'saveFailed' };

  revalidatePath('/[locale]/admin/courses/[id]', 'page');
  return OK;
}
