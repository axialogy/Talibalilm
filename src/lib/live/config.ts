/**
 * Where the live classroom is hosted.
 *
 * Jitsi rather than a mesh of browser-to-browser connections: the school needs
 * 10–50 in a room, and in a mesh the teacher's browser encodes and uploads a
 * separate copy of the video for every single student. Jitsi runs an SFU — the
 * teacher uploads once and the server fans it out — which is the same shape as
 * the paid services, but free and with no 40-minute cap. Escaping that cap is
 * why the school built its own classroom in the first place.
 *
 * The domain is a variable, not a constant, and that is the whole migration
 * plan: start on the public `meet.jit.si`, and if it is ever throttled or the
 * school outgrows it, point this at 8x8's hosted Jitsi or their own server. One
 * value changes; no code does.
 */
const DEFAULT_DOMAIN = 'meet.jit.si';

export function jitsiDomain(): string {
  const configured = process.env.NEXT_PUBLIC_JITSI_DOMAIN?.trim();
  // A bare hostname only. Anything carrying a scheme, a path or a port is a
  // misconfiguration, and it would end up building the script URL we inject.
  if (configured && /^[a-z0-9.-]+$/i.test(configured)) return configured;
  return DEFAULT_DOMAIN;
}

/**
 * The room's name on the Jitsi side.
 *
 * Built from the session's random token, so it is not guessable — but that is
 * defence in depth, not the gate. The gate is `has_course_access()`: a student
 * who is not entitled never receives this name, because the row it comes from
 * is invisible to them.
 */
export function jitsiRoomName(roomToken: string): string {
  return `talibalim-${roomToken}`;
}
