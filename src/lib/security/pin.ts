import { createHmac, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

/**
 * The admin PIN, and the short-lived proof that it was entered.
 *
 * Pure and free of `server-only`, because this is the part worth testing: a
 * hash that does not verify, or a token that accepts an expired signature, is
 * a lock that opens for the wrong person.
 *
 * scrypt rather than a bare SHA: a four-to-eight digit PIN has almost no
 * entropy, and a fast hash turns a stolen `admin_security` row into a few
 * minutes of brute force. scrypt is deliberately slow and is in Node, so no
 * database extension is needed.
 */

const SCRYPT = { N: 16384, r: 8, p: 1, keylen: 64 } as const;

/** A fresh salt per PIN, hex. */
export function newPinSalt(): string {
  return randomBytes(16).toString('hex');
}

/** The PIN, hashed. The salt is stored beside it; the PIN never is. */
export function hashPin(pin: string, salt: string): string {
  return scryptSync(pin.normalize('NFKC'), salt, SCRYPT.keylen, {
    N: SCRYPT.N,
    r: SCRYPT.r,
    p: SCRYPT.p,
  }).toString('hex');
}

/** Constant-time comparison, so a wrong PIN cannot be found a character at a time. */
export function verifyPin(pin: string, hash: string, salt: string): boolean {
  const candidate = Buffer.from(hashPin(pin, salt), 'hex');
  const expected = Buffer.from(hash, 'hex');
  if (candidate.length !== expected.length) return false;
  return timingSafeEqual(candidate, expected);
}

/** What a PIN may look like: digits only, four to eight of them. */
export const PIN_PATTERN = /^\d{4,8}$/;

export const STEPUP_TTL_MS = 15 * 60 * 1000;

function signature(userId: string, expiresAt: number, secret: string): string {
  return createHmac('sha256', secret).update(`${userId}.${expiresAt}`).digest('hex');
}

/**
 * The cookie value: when it expires, and a signature over WHO it unlocks.
 *
 * Binding the signature to the user id is the point — a step-up earned by one
 * admin cannot be replayed by another, even on the same browser.
 */
export function signStepUp(userId: string, expiresAt: number, secret: string): string {
  return `${expiresAt}.${signature(userId, expiresAt, secret)}`;
}

export function verifyStepUp(
  value: string | undefined | null,
  userId: string,
  secret: string,
  now = Date.now(),
): boolean {
  if (!value) return false;

  const [rawExpiry, rawSignature] = value.split('.');
  const expiresAt = Number(rawExpiry);
  if (!Number.isFinite(expiresAt) || expiresAt <= now) return false;
  if (!rawSignature) return false;

  const expected = signature(userId, expiresAt, secret);
  const a = Buffer.from(rawSignature, 'utf8');
  const b = Buffer.from(expected, 'utf8');
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/**
 * The one-time token in a "it was not me" e-mail.
 *
 * Signed with the same secret and bound to the admin who made the change and
 * the moment they made it, so the link cannot be replayed against a different
 * change — and it works from the mailbox, with no session.
 */
export function signRevertToken(userId: string, changedAt: number, secret: string): string {
  return `${changedAt}.${signature(`revert:${userId}`, changedAt, secret)}`;
}

export function verifyRevertToken(
  value: string | undefined | null,
  userId: string,
  secret: string,
  maxAgeMs = 7 * 24 * 60 * 60 * 1000,
  now = Date.now(),
): boolean {
  if (!value) return false;

  const [rawChangedAt, rawSignature] = value.split('.');
  const changedAt = Number(rawChangedAt);
  if (!Number.isFinite(changedAt)) return false;
  if (now - changedAt > maxAgeMs || changedAt > now + 60_000) return false;
  if (!rawSignature) return false;

  const expected = signature(`revert:${userId}`, changedAt, secret);
  const a = Buffer.from(rawSignature, 'utf8');
  const b = Buffer.from(expected, 'utf8');
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
