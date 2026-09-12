import 'server-only';
import { createClient } from '@/lib/supabase/server';
import { supabaseConfigured } from '@/lib/env';
import { reportError } from '@/lib/observability/report';
import type { LiveStatus } from '@/lib/supabase/database.types';

/**
 * Reads for the live classroom.
 *
 * All through the ordinary anon-key client, so the policies decide what comes
 * back. A student's listing is already filtered by `has_course_access()` in the
 * database — there is no `.eq('user_id', …)` here to forget, because the filter
 * is not this layer's job.
 */
export interface LiveSessionView {
  id: string;
  courseId: string;
  courseTitle: string;
  title: string;
  description: string;
  roomToken: string;
  status: LiveStatus;
  scheduledAt: string | null;
  startedAt: string | null;
  endedAt: string | null;
  maxParticipants: number;
  recordingNote: string;
}

interface Row {
  id: string;
  course_id: string;
  title: string;
  description: string;
  room_token: string;
  status: LiveStatus;
  scheduled_at: string | null;
  started_at: string | null;
  ended_at: string | null;
  max_participants: number;
  recording_note: string;
  courses: { title: string } | null;
}

const SELECT =
  'id, course_id, title, description, room_token, status, scheduled_at, started_at, ended_at, max_participants, recording_note, courses ( title )';

function toView(row: Row): LiveSessionView {
  return {
    id: row.id,
    courseId: row.course_id,
    courseTitle: row.courses?.title ?? '',
    title: row.title,
    description: row.description,
    roomToken: row.room_token,
    status: row.status,
    scheduledAt: row.scheduled_at,
    startedAt: row.started_at,
    endedAt: row.ended_at,
    maxParticipants: row.max_participants,
    recordingNote: row.recording_note,
  };
}

/** Every class the caller is allowed to see, soonest first. */
export async function listLiveSessions(courseId?: string): Promise<LiveSessionView[]> {
  if (!supabaseConfigured) return [];
  const supabase = await createClient();

  let query = supabase
    .from('live_sessions')
    .select(SELECT)
    .order('scheduled_at', { ascending: false, nullsFirst: false })
    .limit(200);
  if (courseId) query = query.eq('course_id', courseId);

  const { data, error } = await query;
  if (error) {
    reportError('live.list', error);
    return [];
  }
  return (data as unknown as Row[]).map(toView);
}

export async function getLiveSession(id: string): Promise<LiveSessionView | undefined> {
  if (!supabaseConfigured) return undefined;
  const supabase = await createClient();

  const { data, error } = await supabase.from('live_sessions').select(SELECT).eq('id', id).maybeSingle();
  if (error) {
    reportError('live.get', error, { id });
    return undefined;
  }
  return data ? toView(data as unknown as Row) : undefined;
}

/**
 * Find a room by its token.
 *
 * Returns nothing for a student without the entitlement — not because this
 * function checks, but because the policy makes the row invisible. That is the
 * point: a forwarded link is not a way in.
 */
export async function getLiveSessionByToken(token: string): Promise<LiveSessionView | undefined> {
  if (!supabaseConfigured) return undefined;
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('live_sessions')
    .select(SELECT)
    .eq('room_token', token)
    .maybeSingle();
  if (error) {
    reportError('live.byToken', error);
    return undefined;
  }
  return data ? toView(data as unknown as Row) : undefined;
}

export interface JoinRequestView {
  id: string;
  userId: string;
  displayName: string;
  status: 'pending' | 'approved' | 'rejected';
  requestedAt: string;
}

/** Who is waiting at the door. Staff-visible; a student sees only their own row. */
export async function listJoinRequests(sessionId: string): Promise<JoinRequestView[]> {
  if (!supabaseConfigured) return [];
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('live_join_requests')
    .select('id, user_id, display_name, status, requested_at')
    .eq('session_id', sessionId)
    .order('requested_at', { ascending: true });
  if (error) {
    reportError('live.joinRequests', error, { sessionId });
    return [];
  }
  return (data ?? []).map((r) => ({
    id: r.id,
    userId: r.user_id,
    displayName: r.display_name,
    status: r.status,
    requestedAt: r.requested_at,
  }));
}
