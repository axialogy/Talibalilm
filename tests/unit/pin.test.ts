import { describe, expect, it } from 'vitest';
import {
  hashPin,
  newPinSalt,
  PIN_PATTERN,
  signRevertToken,
  signStepUp,
  verifyPin,
  verifyRevertToken,
  verifyStepUp,
} from '@/lib/security/pin';

/**
 * The lock on the PayPal screen.
 *
 * A hash that verifies the wrong PIN, or a token that accepts an expired one,
 * is a lock that opens for somebody else — so both are pinned here.
 */

const SECRET = 'a-test-secret-that-is-long-enough';

describe('the PIN', () => {
  it('accepts the right PIN and refuses everything else', () => {
    const salt = newPinSalt();
    const hash = hashPin('4821', salt);

    expect(verifyPin('4821', hash, salt)).toBe(true);
    expect(verifyPin('4822', hash, salt)).toBe(false);
    expect(verifyPin('', hash, salt)).toBe(false);
    expect(verifyPin('4821', hash, newPinSalt())).toBe(false);
  });

  it('never stores the PIN itself', () => {
    const salt = newPinSalt();
    const hash = hashPin('1234', salt);
    expect(hash).not.toContain('1234');
    expect(hash).toHaveLength(128);
  });

  it('gives two admins with the same PIN different hashes', () => {
    expect(hashPin('1111', newPinSalt())).not.toBe(hashPin('1111', newPinSalt()));
  });

  it('only takes four to eight digits', () => {
    expect(PIN_PATTERN.test('1234')).toBe(true);
    expect(PIN_PATTERN.test('12345678')).toBe(true);
    expect(PIN_PATTERN.test('123')).toBe(false);
    expect(PIN_PATTERN.test('123456789')).toBe(false);
    expect(PIN_PATTERN.test('12ab')).toBe(false);
  });
});

describe('the step-up token', () => {
  it('verifies for the admin it was signed for, until it expires', () => {
    const now = Date.now();
    const token = signStepUp('user-1', now + 60_000, SECRET);

    expect(verifyStepUp(token, 'user-1', SECRET, now)).toBe(true);
    // Bound to the person: another admin cannot replay it.
    expect(verifyStepUp(token, 'user-2', SECRET, now)).toBe(false);
    // And it dies on time.
    expect(verifyStepUp(token, 'user-1', SECRET, now + 120_000)).toBe(false);
  });

  it('refuses a tampered or missing token', () => {
    const now = Date.now();
    const token = signStepUp('user-1', now + 60_000, SECRET);

    expect(verifyStepUp(undefined, 'user-1', SECRET, now)).toBe(false);
    expect(verifyStepUp('', 'user-1', SECRET, now)).toBe(false);
    expect(verifyStepUp(`${now + 60_000}.deadbeef`, 'user-1', SECRET, now)).toBe(false);
    expect(verifyStepUp(token, 'user-1', 'another-secret', now)).toBe(false);
  });
});

describe('the revert token', () => {
  it('verifies for a week, and only for its admin and moment', () => {
    const changedAt = Date.now();
    const token = signRevertToken('admin-1', changedAt, SECRET);

    expect(verifyRevertToken(token, 'admin-1', SECRET, undefined, changedAt + 1000)).toBe(true);
    expect(verifyRevertToken(token, 'admin-2', SECRET, undefined, changedAt + 1000)).toBe(false);
    // Eight days later it is stale.
    expect(
      verifyRevertToken(token, 'admin-1', SECRET, undefined, changedAt + 8 * 86_400_000),
    ).toBe(false);
  });
});
