'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { supabaseConfigured } from '@/lib/env';
import { requireStaff } from '@/lib/auth/guards';
import type { AdminState } from '@/app/actions/admin';

/**
 * Running a live class.
 *
 * Every write goes through the ordinary anon-key client, so the `is_staff()`
 * policies on `live_sessions` are the control — the same rule the rest of the
 * admin follows. Joining and leaving go through the security-definer functions
 * instead, because those must answer "may this person be here?" identically for
 * the classroom page, the attendance log and any future token route.
 */

const OK: AdminState = { ok: true };

async function staffClient() {
  if (!supabaseConfigured) throw new Error('unavailable');
  await requireStaff();
  return createClient();
}

const createSchema = z.object({
  courseId: z.string().uuid(),
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(2000).default(''),
  // `datetime-local` gives no zone; the browser's own offset is attached below.
  scheduledAt: z.string().trim().max(40).optional(),
  maxParticipants: z.coerce.number().int().min(2).max(500).default(50),
});

export async function createLiveSession(_prev: AdminState, formData: FormData): Promise<AdminState> {
  const parsed = createSchema.safeParse({
    courseId: formData.get('courseId'),
    title: formData.get('title'),
    description: formData.get('description') ?? '',
    scheduledAt: (formData.get('scheduledAt') as string) || undefined,
    maxParticipants: formData.get('maxParticipants') || 50,
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? 'invalid' };

  const when = parsed.data.scheduledAt ? new Date(parsed.data.scheduledAt) : null;
  if (when && Number.isNaN(when.getTime())) return { ok: false, error: 'invalid' };

  const supabase = await staffClient();
  const { error } = await supabase.from('live_sessions').insert({
    course_id: parsed.data.courseId,
    title: parsed.data.title,
    description: parsed.data.description,
    scheduled_at: when ? when.toISOString() : null,
    max_participants: parsed.data.maxParticipants,
  });
  if (error) return { ok: false, error: 'saveFailed' };

  revalidatePath('/[locale]/admin/live', 'page');
  return OK;
}

const idSchema = z.object({ id: z.string().uuid() });

/**
 * Open the room.
 *
 * `started_at` is stamped once and kept: a host who reloads mid-class must not
 * reset the clock the attendance list is read against.
 */
export async function startLiveSession(_prev: AdminState, formData: FormData): Promise<AdminState> {
  const parsed = idSchema.safeParse({ id: formData.get('id') });
  if (!parsed.success) return { ok: false, error: 'invalid' };

  const supabase = await staffClient();
  const { data: existing } = await supabase
    .from('live_sessions')
    .select('started_at')
    .eq('id', parsed.data.id)
    .maybeSingle();

  const { error } = await supabase
    .from('live_sessions')
    .update({
      status: 'live',
      started_at: existing?.started_at ?? new Date().toISOString(),
      ended_at: null,
    })
    .eq('id', parsed.data.id);
  if (error) return { ok: false, error: 'saveFailed' };

  revalidatePath('/[locale]/admin/live', 'page');
  return OK;
}

export async function endLiveSession(_prev: AdminState, formData: FormData): Promise<AdminState> {
  const parsed = idSchema.safeParse({ id: formData.get('id') });
  if (!parsed.success) return { ok: false, error: 'invalid' };

  const supabase = await staffClient();
  const { error } = await supabase
    .from('live_sessions')
    .update({ status: 'ended', ended_at: new Date().toISOString() })
    .eq('id', parsed.data.id);
  if (error) return { ok: false, error: 'saveFailed' };

  // Ending the class closes the door for everyone: `can_join_live` refuses an
  // ended session, so nobody wanders back in afterwards.
  revalidatePath('/[locale]/admin/live', 'page');
  return OK;
}

export async function cancelLiveSession(_prev: AdminState, formData: FormData): Promise<AdminState> {
  const parsed = idSchema.safeParse({ id: formData.get('id') });
  if (!parsed.success) return { ok: false, error: 'invalid' };

  const supabase = await staffClient();
  const { error } = await supabase
    .from('live_sessions')
    .update({ status: 'cancelled' })
    .eq('id', parsed.data.id);
  if (error) return { ok: false, error: 'saveFailed' };

  revalidatePath('/[locale]/admin/live', 'page');
  return OK;
}

/** Note where the recording ended up, so "was this class recorded?" stays answerable. */
export async function noteRecording(_prev: AdminState, formData: FormData): Promise<AdminState> {
  const parsed = z
    .object({ id: z.string().uuid(), note: z.string().trim().max(500).default('') })
    .safeParse({ id: formData.get('id'), note: formData.get('note') ?? '' });
  if (!parsed.success) return { ok: false, error: 'invalid' };

  const supabase = await staffClient();
  const { error } = await supabase
    .from('live_sessions')
    .update({ recording_note: parsed.data.note })
    .eq('id', parsed.data.id);
  if (error) return { ok: false, error: 'saveFailed' };

  revalidatePath('/[locale]/admin/live', 'page');
  return OK;
}

/** Admit or refuse someone waiting at the door. The RPC re-checks staff itself. */
export async function decideJoinRequest(_prev: AdminState, formData: FormData): Promise<AdminState> {
  const parsed = z
    .object({ requestId: z.string().uuid(), admit: z.coerce.boolean() })
    .safeParse({
      requestId: formData.get('requestId'),
      admit: formData.get('admit') === 'yes',
    });
  if (!parsed.success) return { ok: false, error: 'invalid' };

  const supabase = await staffClient();
  const { error } = await supabase.rpc('live_decide_join', {
    request_id: parsed.data.requestId,
    admit: parsed.data.admit,
  });
  if (error) return { ok: false, error: 'saveFailed' };

  revalidatePath('/[locale]/admin/live', 'page');
  return OK;
}

/**
 * Record that the caller entered or left a room.
 *
 * Called from the classroom page, not from an admin screen, so it deliberately
 * does NOT require staff — `live_join` refuses anyone `can_join_live` refuses,
 * which is the entitlement check.
 */
export async function joinRoom(sessionId: string): Promise<void> {
  if (!supabaseConfigured) return;
  const supabase = await createClient();
  await supabase.rpc('live_join', { session_id: sessionId });
}

export async function leaveRoom(sessionId: string): Promise<void> {
  if (!supabaseConfigured) return;
  const supabase = await createClient();
  await supabase.rpc('live_leave', { session_id: sessionId });
}
