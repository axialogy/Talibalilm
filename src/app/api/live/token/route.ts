import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { supabaseConfigured } from '@/lib/env';
import { currentViewer } from '@/lib/auth/guards';
import { getLiveSessionByToken } from '@/lib/data/live';
import { ablyConfigured, mintRoomToken } from '@/lib/live/ably';
import { reportError } from '@/lib/observability/report';
import type { LiveRoomState } from '@/lib/supabase/database.types';

export const dynamic = 'force-dynamic';

/**
 * The classroom's realtime credential.
 *
 * Called by the browser on entry and again whenever its token is about to
 * expire. Every call re-asks the database, which is the point: nothing about
 * being in the room is cached in the browser, so a student the teacher removes
 * mid-class fails their next renewal and drops out. A token, once minted, is
 * only as long-lived as the hour it was granted for.
 *
 * The three questions are answered in this order, and each is answered by the
 * database rather than by anything the request carries:
 *
 *   1. Who is this? — the session cookie, not a body field.
 *   2. Is there such a room? — an RLS-gated read, so a student who does not
 *      hold the module gets nothing back and the answer is "no such room"
 *      rather than "you may not". Holding the link is not holding a key.
 *   3. What may they do in it? — `live_room_state`, the same function the room
 *      page and the chat policy ask, so the three cannot drift apart.
 *
 * The role decides the capability, and the capability is what actually stops a
 * student muting the class. Nothing here trusts an `isHost` from the client
 * because nothing here reads one.
 */
export async function POST(request: NextRequest) {
  if (!supabaseConfigured) {
    return NextResponse.json({ error: 'not_configured' }, { status: 503 });
  }
  if (!ablyConfigured) {
    // A no-op rather than a crash, like every other optional integration: the
    // room reports that realtime is unavailable and nobody sees a stack trace.
    return NextResponse.json({ error: 'realtime_unavailable' }, { status: 503 });
  }

  const viewer = await currentViewer();
  if (!viewer) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });

  const body = await request.json().catch(() => null);
  const parsed = z.object({ roomToken: z.string().min(8).max(128) }).safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'invalid' }, { status: 400 });

  const session = await getLiveSessionByToken(parsed.data.roomToken);
  if (!session) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  const supabase = await createClient();
  const { data: state, error } = await supabase.rpc('live_room_state', {
    session_id: session.id,
  });
  if (error) {
    reportError('live.roomState', error, { sessionId: session.id });
    return NextResponse.json({ error: 'unavailable' }, { status: 503 });
  }
  // Null means the door is shut: not entitled, removed from the class, or the
  // class is over. The same answer for all three, deliberately — which one it
  // is, is not a student's business to learn from an error code.
  if (!state) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const room: LiveRoomState = state;

  const token = await mintRoomToken(
    session.roomToken,
    viewer.id,
    room.is_host ? 'host' : 'participant',
  );
  if (!token) return NextResponse.json({ error: 'realtime_unavailable' }, { status: 503 });

  return NextResponse.json({ token, room }, { headers: { 'Cache-Control': 'no-store' } });
}
