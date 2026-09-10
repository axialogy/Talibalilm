import { createClient } from '@/lib/supabase/server';
import { supabaseConfigured } from '@/lib/env';
import type { LessonContentRow, MembershipRow, ProgressRow } from '@/lib/supabase/database.types';

/**
 * Member-only reads.
 *
 * Everything here goes through the request-scoped anon client, so RLS decides.
 * That is deliberate: a non-member calling `getLessonContent` gets `null`
 * because the database returned nothing, not because a branch above it chose
 * to hide something. The service-role client is never used on this path — if
 * it were, a bug in a caller would become a content leak.
 */

export interface LessonContent {
  content: string;
  videoProvider: LessonContentRow['video_provider'];
  /** An opaque id, never a playable URL. Exchanged for a signed URL in Phase 5. */
  videoId: string | null;
}

/** Null when the caller may not read it — which is the same answer as "absent". */
export async function getLessonContent(lessonId: string): Promise<LessonContent | null> {
  if (!supabaseConfigured) return null;

  const supabase = await createClient();
  const { data } = await supabase
    .from('lesson_content')
    .select('content, video_provider, video_id')
    .eq('lesson_id', lessonId)
    .maybeSingle();

  if (!data) return null;
  return {
    content: data.content,
    videoProvider: data.video_provider,
    videoId: data.video_id,
  };
}

export async function getMembership(): Promise<MembershipRow | null> {
  if (!supabaseConfigured) return null;

  const supabase = await createClient();
  const { data } = await supabase
    .from('memberships')
    .select('*')
    .eq('status', 'active')
    .maybeSingle();

  // Trust the clock rather than the stored status: the nightly sweep may not
  // have run, and the RLS gate makes the same judgement.
  if (!data) return null;
  return new Date(data.expires_at) > new Date() ? data : null;
}

export async function hasActiveMembership(): Promise<boolean> {
  return (await getMembership()) !== null;
}

/** Days left, or null when there is no live membership. */
export function daysRemaining(membership: MembershipRow | null): number | null {
  if (!membership) return null;
  const ms = new Date(membership.expires_at).getTime() - Date.now();
  return Math.max(0, Math.ceil(ms / 86_400_000));
}

export async function getCourseProgress(lessonIds: string[]): Promise<Map<string, ProgressRow>> {
  const byLesson = new Map<string, ProgressRow>();
  if (!supabaseConfigured || lessonIds.length === 0) return byLesson;

  const supabase = await createClient();
  const { data } = await supabase.from('lesson_progress').select('*').in('lesson_id', lessonIds);

  for (const row of data ?? []) byLesson.set(row.lesson_id, row);
  return byLesson;
}

/**
 * Record that the student opened this course.
 *
 * Enrolment is a bookmark, not a gate — rule 3 says one membership unlocks
 * everything — so it is created on first access rather than by an explicit
 * act, and a failure here must never block the lesson from rendering.
 */
export async function touchEnrollment(courseId: string, userId: string): Promise<void> {
  if (!supabaseConfigured) return;

  const supabase = await createClient();
  const { error } = await supabase
    .from('enrollments')
    .upsert(
      { user_id: userId, course_id: courseId, last_accessed_at: new Date().toISOString() },
      { onConflict: 'user_id,course_id' },
    );

  if (error) console.error('[enrollments] touch failed:', error.message);
}
