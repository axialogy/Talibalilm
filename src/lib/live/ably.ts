import 'server-only';
import Ably from 'ably';
import { reportError } from '@/lib/observability/report';
import { roomCapability, type RoomRole } from './channels';

/**
 * Ably, server-side only.
 *
 * `server-only` at the top is doing real work here. The root key can create
 * tokens for every channel in the account; the old WordPress plugin printed it
 * into the HTML of every room, which is why that key had to be revoked. The
 * import boundary makes the same mistake a build failure rather than a silent
 * leak — a Client Component that reaches for this module does not compile.
 *
 * The browser never sees the key. It asks this server for a token, and the
 * token it gets back is scoped to one room's two channels with the capability
 * its role has earned. Ably enforces that: a message the token does not cover
 * is refused before it reaches anyone.
 */

const KEY = process.env.ABLY_API_KEY?.trim() ?? '';

/** Unset, the classroom says realtime is unavailable rather than crashing. */
export const ablyConfigured = Boolean(KEY);

let rest: Ably.Rest | null = null;

function client(): Ably.Rest {
  if (!rest) rest = new Ably.Rest({ key: KEY });
  return rest;
}

/**
 * A token request for one person in one room.
 *
 * `clientId` is the user's own id and is baked into the token by Ably, not
 * chosen per message. So a participant cannot publish or enter presence as
 * somebody else: the identity on every message is the one this server put
 * there after the database confirmed who they are. That is what stops a
 * student forging a message from the teacher.
 *
 * Short-lived on purpose. A class runs for an hour or two and the client
 * renews; a token that escaped stops being useful quickly, and a student
 * removed mid-class loses their next renewal because the endpoint re-asks the
 * database every time.
 */
export async function mintRoomToken(
  roomToken: string,
  userId: string,
  role: RoomRole,
): Promise<Ably.TokenRequest | null> {
  if (!ablyConfigured) return null;
  try {
    // `capability` is typed as Ably's own operation union; the shape is built
    // and tested in `channels.ts`, which is where the security rule belongs.
    return await client().auth.createTokenRequest({
      clientId: userId,
      capability: roomCapability(roomToken, role) as Ably.TokenParams['capability'],
      ttl: 60 * 60 * 1000,
    });
  } catch (error) {
    reportError('ably.mintToken', error, { role });
    return null;
  }
}
