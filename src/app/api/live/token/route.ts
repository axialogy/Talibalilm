import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { supabaseConfigured } from '@/lib/env';
import { currentViewer } from '@/lib/auth/guards';
import { getLiveSessionByToken } from '@/lib/data/live';
import { liveKitConfigured, liveKitUrl, mintRoomToken } from '@/lib/live/server';
import { reportError } from '@/lib/observability/report';
import type { LiveRoomState } from '@/lib/supabase/database.types';

export const dynamic = 'force-dynamic';

/**
 * The classroom credential.
 *
 * Called on entry and again whenever the token is close to expiring. Every call
 * re-asks the database, which is the point: nothing about being allowed in the
 * room is cached in the browser, so a student the teacher removes mid-class
 * fails their next renewal and drops out.
 *
 * Three questions, in order, each answered by the database rather than by
 * anything the request carries:
 *
 *   1. Who is this? — the session cookie, never a field in the body.
 *   2. Is there such a class? — an RLS-gated read, so a student who does not
 *      hold the module gets nothing back and the answer is "no such room"
 *      rather than "you may not". Holding the link is not holding a key.
 *   3. What may they do in it? — `live_room_state`, the same function the room
 *      page and the chat policy ask, so the three cannot drift apart.
 *
 * Nothing here reads an `isHost` from the client, because nothing here would
 * believe one.
 */
export async function POST(request: NextRequest) {
  if (!supabaseConfigured) {
    return NextResponse.json({ error: 'not_configured' }, { status: 503 });
  }
  if (!liveKitConfigured) {
    return NextResponse.json({ error: 'realtime_unavailable' }, { status: 503 });
  }

  const viewer = await currentViewer();
  if (!viewer) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });

  const parsed = z
    .object({ roomToken: z.string().min(8).max(128) })
    .safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'invalid' }, { status: 400 });

  const session = await getLiveSessionByToken(parsed.data.roomToken);
  if (!session) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('live_room_state', { session_id: session.id });
  if (error) {
    reportError('live.roomState', error, { sessionId: session.id });
    return NextResponse.json({ error: 'unavailable' }, { status: 503 });
  }
  // Null covers three cases — not entitled, removed from the class, class over.
  // They get the same answer, deliberately: which one it is, is not something a
  // student should be able to learn from an error code.
  if (!data) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const room: LiveRoomState = data;
  const token = await mintRoomToken(
    session.roomToken,
    viewer.id,
    viewer.fullName || viewer.email || 'Étudiant',
    {
      isHost: room.is_host,
      muted: room.muted,
      cameraAllowed: room.camera_allowed,
      screenAllowed: room.screen_allowed,
    },
  );
  if (!token) return NextResponse.json({ error: 'realtime_unavailable' }, { status: 503 });

  return NextResponse.json(
    { token, url: liveKitUrl, room },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
