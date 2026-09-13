import 'server-only';
import { AccessToken, RoomServiceClient } from 'livekit-server-sdk';
import { reportError } from '@/lib/observability/report';
import { TrackSource as TrackSourceProto } from '@livekit/protocol';
import { liveKitRoom, roomGrant, type RoomPermissions, type TrackSource } from './grants';

/**
 * LiveKit, server-side only.
 *
 * `server-only` is load-bearing. The API secret signs tokens for every room in
 * the project; the WordPress plugin this replaces printed its realtime key into
 * the HTML of every classroom, which is why that key had to be revoked. The
 * import boundary turns the same mistake into a build failure instead of a
 * silent leak.
 *
 * Two jobs live here. Minting the token a browser joins with, and — the part
 * that makes host controls real — calling LiveKit's own server API so that
 * muting a student changes what the media server will accept from them, not
 * merely what their page displays.
 */

const URL = process.env.LIVEKIT_URL?.trim() || process.env.NEXT_PUBLIC_LIVEKIT_URL?.trim() || '';
const KEY = process.env.LIVEKIT_API_KEY?.trim() ?? '';
const SECRET = process.env.LIVEKIT_API_SECRET?.trim() ?? '';

/** Unset, the classroom says so plainly instead of crashing. */
export const liveKitConfigured = Boolean(URL && KEY && SECRET);

/** The https form of the websocket URL, which the server API wants. */
function httpUrl(): string {
  return URL.replace(/^ws/, 'http');
}

let rooms: RoomServiceClient | null = null;

function service(): RoomServiceClient {
  if (!rooms) rooms = new RoomServiceClient(httpUrl(), KEY, SECRET);
  return rooms;
}

/**
 * The token one person joins one class with.
 *
 * `identity` is the user's own id, signed in by this server after the database
 * said who they are. A participant cannot appear as somebody else, so the name
 * on a chat message or a raised hand is not something a browser chose.
 *
 * Short-lived, and renewed by the client. That is what makes removal work: a
 * student the teacher takes out of the class fails their next renewal, because
 * the endpoint re-asks the database every time rather than trusting a token
 * minted an hour ago.
 */
export async function mintRoomToken(
  roomToken: string,
  userId: string,
  displayName: string,
  permissions: RoomPermissions,
): Promise<string | null> {
  if (!liveKitConfigured) return null;
  try {
    const room = liveKitRoom(roomToken);
    const token = new AccessToken(KEY, SECRET, {
      identity: userId,
      name: displayName,
      ttl: '2h',
    });
    const grant = roomGrant(room, permissions);
    token.addGrant({ ...grant, canPublishSources: sources(grant.canPublishSources) });
    return await token.toJwt();
  } catch (error) {
    reportError('livekit.mintToken', error);
    return null;
  }
}

/**
 * Apply the host's decision at the media server.
 *
 * The database is the record — a mute has to survive a reload, so it is a
 * column. This is the other half: rewriting the live permission so the change
 * takes effect in the class that is happening now rather than at the student's
 * next join. Without it, "mute" would be a note for later.
 *
 * Best-effort by design. If LiveKit is unreachable the database write has
 * already happened, so the decision is not lost — it lands when they reconnect.
 */
export async function applyPermissions(
  roomToken: string,
  userId: string,
  permissions: RoomPermissions,
): Promise<void> {
  if (!liveKitConfigured) return;
  try {
    const room = liveKitRoom(roomToken);
    const grant = roomGrant(room, permissions);
    await service().updateParticipant(room, userId, undefined, {
      canPublish: grant.canPublish,
      canSubscribe: true,
      canPublishData: true,
      canPublishSources: sources(grant.canPublishSources),
    });
  } catch (error) {
    reportError('livekit.updateParticipant', error, { roomToken });
  }
}

/** Disconnect someone the teacher has removed, rather than waiting for their token to lapse. */
export async function evictParticipant(roomToken: string, userId: string): Promise<void> {
  if (!liveKitConfigured) return;
  try {
    await service().removeParticipant(liveKitRoom(roomToken), userId);
  } catch (error) {
    // Already gone is the common case and is not a failure.
    reportError('livekit.removeParticipant', error, { roomToken });
  }
}

/**
 * LiveKit's wire enum for a track source.
 *
 * `grants.ts` deals in readable names so its tests read as rules rather than as
 * magic numbers; the translation to LiveKit's protocol numbers happens here, at
 * the one seam that talks to LiveKit at all.
 */
const SOURCE: Record<TrackSource, TrackSourceProto> = {
  camera: TrackSourceProto.CAMERA,
  microphone: TrackSourceProto.MICROPHONE,
  screen_share: TrackSourceProto.SCREEN_SHARE,
  screen_share_audio: TrackSourceProto.SCREEN_SHARE_AUDIO,
};

function sources(list: TrackSource[]): TrackSourceProto[] {
  return list.map((s) => SOURCE[s]);
}
