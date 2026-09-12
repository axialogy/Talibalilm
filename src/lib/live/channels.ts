/**
 * The two channels a classroom runs on, and who may do what on each.
 *
 * This is the security boundary of the whole room, so it is a pure function
 * with tests rather than an object literal built inline next to the Ably call.
 *
 * Why two channels and not one. Ably grants capability per channel, not per
 * message name — so a single shared channel would mean any student's token
 * could publish `force_mute` or `wb_clear` and every other browser would act on
 * it. Hiding the button in React would be the only thing stopping them, which
 * is not stopping them at all. Splitting the traffic moves the refusal into the
 * token itself:
 *
 *   signal   everyone publishes — WebRTC offers, their own mic and camera
 *            state, chat, a raised hand, a request to turn a camera on
 *   control  ONLY the host publishes — muting someone, allowing a camera,
 *            removing a student, the whiteboard, the current slide, ending the
 *            class. Students subscribe and obey; they cannot speak on it.
 *
 * A student's browser is handed a token with no publish capability on
 * `control`. The message is refused by Ably before it reaches anyone, whatever
 * the page was persuaded to send.
 */

export type RoomRole = 'host' | 'participant';

/** Channel names are derived from the room token, never from anything a client sends. */
export function signalChannel(roomToken: string): string {
  return `live:${roomToken}:signal`;
}

export function controlChannel(roomToken: string): string {
  return `live:${roomToken}:control`;
}

/**
 * What the holder of this token may do, in Ably's capability shape.
 *
 * Scoped to one room's two channels and nothing else: a token minted for one
 * class carries no capability naming another, so a student cannot subscribe to
 * a class they did not buy even if they learn its room token.
 */
export function roomCapability(roomToken: string, role: RoomRole): Record<string, string[]> {
  const signal = signalChannel(roomToken);
  const control = controlChannel(roomToken);

  if (role === 'host') {
    return {
      [signal]: ['publish', 'subscribe', 'presence'],
      [control]: ['publish', 'subscribe', 'presence'],
    };
  }

  return {
    [signal]: ['publish', 'subscribe', 'presence'],
    // Subscribe only. This single omission is what makes a student unable to
    // mute the class, clear the whiteboard or end the lesson.
    [control]: ['subscribe'],
  };
}

/**
 * Every message the room understands.
 *
 * Taken from the plugin this replaces, so nothing it did is quietly dropped,
 * and typed here so a typo becomes a build error rather than an event that
 * silently never arrives. Which channel each one travels on is not a detail —
 * it is what the capability above enforces.
 */
export const SIGNAL_EVENTS = [
  // WebRTC, peer to peer. Ably carries the negotiation, never the media.
  'offer',
  'answer',
  'ice',
  // Presence and the door.
  'join',
  'leave',
  'join-request',
  // A participant describing their own state — never anyone else's.
  'mic-state',
  'cam-state',
  'screen-state',
  'hand',
  // Asking the teacher for something.
  'ask-camera',
  'ask-screen',
  // Chat.
  'chat',
] as const;

export const CONTROL_EVENTS = [
  // The host acting on one participant.
  'force-mute',
  'force-unmute',
  'force-cam-off',
  'allow-camera',
  'allow-screen',
  'deny-request',
  'remove',
  'admit',
  // The host acting on the room.
  'board-op',
  'board-clear',
  'slide',
  'chat-lock',
  'recording',
  'ended',
] as const;

export type SignalEvent = (typeof SIGNAL_EVENTS)[number];
export type ControlEvent = (typeof CONTROL_EVENTS)[number];
