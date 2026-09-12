import { describe, expect, it } from 'vitest';
import {
  controlChannel,
  roomCapability,
  signalChannel,
  CONTROL_EVENTS,
  SIGNAL_EVENTS,
} from '@/lib/live/channels';

const ROOM = 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6';
const OTHER = '00001111222233334444555566667777';

describe('roomCapability', () => {
  it('lets a student speak on the signal channel', () => {
    const cap = roomCapability(ROOM, 'participant');
    expect(cap[signalChannel(ROOM)]).toEqual(['publish', 'subscribe', 'presence']);
  });

  it('does NOT let a student publish on the control channel', () => {
    // The single most important assertion about the classroom. Without it a
    // student's token could mute the class, wipe the whiteboard or end the
    // lesson, and only a hidden button would be stopping them.
    const cap = roomCapability(ROOM, 'participant');
    expect(cap[controlChannel(ROOM)]).toEqual(['subscribe']);
    expect(cap[controlChannel(ROOM)]).not.toContain('publish');
    expect(cap[controlChannel(ROOM)]).not.toContain('presence');
  });

  it('lets the host publish on both', () => {
    const cap = roomCapability(ROOM, 'host');
    expect(cap[controlChannel(ROOM)]).toContain('publish');
    expect(cap[signalChannel(ROOM)]).toContain('publish');
  });

  it('names one room and no other', () => {
    // A token minted for one class must be useless against another, so that
    // learning a room token buys nothing without the entitlement behind it.
    for (const role of ['host', 'participant'] as const) {
      const keys = Object.keys(roomCapability(ROOM, role));
      expect(keys).toHaveLength(2);
      expect(keys.every((k) => k.includes(ROOM))).toBe(true);
      expect(keys.some((k) => k.includes(OTHER))).toBe(false);
      // No wildcard ever: '*' would hand the holder the whole Ably app.
      expect(keys.some((k) => k.includes('*'))).toBe(false);
    }
  });
});

describe('the room protocol', () => {
  it('keeps every host command off the channel students can publish to', () => {
    const overlap = CONTROL_EVENTS.filter((e) => (SIGNAL_EVENTS as readonly string[]).includes(e));
    expect(overlap).toEqual([]);
  });

  it('carries every capability the old plugin had', () => {
    // The WordPress room's message list, so nothing it did is quietly lost.
    const all = [...SIGNAL_EVENTS, ...CONTROL_EVENTS];
    for (const needed of [
      'offer', 'answer', 'ice',
      'chat', 'hand',
      'force-mute', 'force-unmute', 'force-cam-off',
      'ask-camera', 'allow-camera',
      'board-op', 'board-clear',
      'slide', 'screen-state', 'recording', 'ended', 'remove',
    ]) {
      expect(all).toContain(needed);
    }
  });
});
