'use server';

import { cookies, headers } from 'next/headers';
import { z } from 'zod';
import { requireAdmin } from '@/lib/auth/guards';
import { createAdminClient } from '@/lib/supabase/server';
import { clientKey, rateLimit } from '@/lib/rate-limit';
import { reportError } from '@/lib/observability/report';
import {
  hashPin,
  newPinSalt,
  PIN_PATTERN,
  signStepUp,
  STEPUP_TTL_MS,
  verifyPin,
} from '@/lib/security/pin';
import { STEPUP_COOKIE, stepUpSecret } from '@/lib/security/stepup-server';

/**
 * The PIN that stands in front of the PayPal configuration.
 *
 * A stolen admin session can read nothing from `payment_settings` — the table
 * grants sessions nothing — but it could WRITE new credentials and collect the
 * school's payments. This is the second lock on that one door.
 *
 * Three properties matter and each is enforced somewhere different:
 *   * the PIN is hashed with scrypt in Node, so a stolen `admin_security` row
 *     is not a PIN (no database extension involved);
 *   * a wrong PIN is counted in the database, so the lockout survives a deploy;
 *   * the proof of entry is a signed cookie bound to the admin's id and dying
 *     after fifteen minutes, checked by the save action and not only by the
 *     page.
 */

export interface PinState {
  ok: boolean;
  /** A key under `admin.security`, resolved by the component. */
  error?:
    | 'unconfigured'
    | 'rateLimited'
    | 'locked'
    | 'wrong'
    | 'tooShort'
    | 'mismatch'
    | 'saveFailed';
}

const MAX_ATTEMPTS = 5;
const LOCK_MS = 15 * 60 * 1000;

async function unlock(userId: string, secret: string): Promise<void> {
  const expiresAt = Date.now() + STEPUP_TTL_MS;
  (await cookies()).set(STEPUP_COOKIE, signStepUp(userId, expiresAt, secret), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: Math.floor(STEPUP_TTL_MS / 1000),
  });
}

async function throttle(scope: string, limit: number): Promise<boolean> {
  const { ok } = await rateLimit(clientKey(await headers(), scope), {
    limit,
    windowMs: 15 * 60 * 1000,
  });
  return ok;
}

/**
 * Set the PIN for the first time, or change it.
 *
 * Changing it needs the current one: otherwise a stolen session could set its
 * own PIN and the second lock would be the attacker's.
 */
export async function setAdminPin(_previous: PinState, formData: FormData): Promise<PinState> {
  const viewer = await requireAdmin();
  const secret = stepUpSecret();
  if (!secret) return { ok: false, error: 'unconfigured' };

  const parsed = z
    .object({
      pin: z.string().trim(),
      confirm: z.string().trim(),
      currentPin: z.string().trim().optional().default(''),
    })
    .safeParse({
      pin: formData.get('pin'),
      confirm: formData.get('confirm'),
      currentPin: formData.get('currentPin') ?? '',
    });
  if (!parsed.success) return { ok: false, error: 'tooShort' };
  if (!PIN_PATTERN.test(parsed.data.pin)) return { ok: false, error: 'tooShort' };
  if (parsed.data.pin !== parsed.data.confirm) return { ok: false, error: 'mismatch' };

  if (!(await throttle('admin-pin-set', 10))) return { ok: false, error: 'rateLimited' };

  const admin = createAdminClient();
  const { data: existing } = await admin
    .from('admin_security')
    .select('pin_hash, pin_salt, locked_until')
    .eq('user_id', viewer.id)
    .maybeSingle();

  if (existing) {
    if (existing.locked_until && new Date(existing.locked_until).getTime() > Date.now()) {
      return { ok: false, error: 'locked' };
    }
    if (!parsed.data.currentPin) return { ok: false, error: 'wrong' };
    if (!verifyPin(parsed.data.currentPin, existing.pin_hash, existing.pin_salt)) {
      return { ok: false, error: 'wrong' };
    }
  }

  const salt = newPinSalt();
  const { error } = await admin.from('admin_security').upsert({
    user_id: viewer.id,
    pin_hash: hashPin(parsed.data.pin, salt),
    pin_salt: salt,
    failed_attempts: 0,
    locked_until: null,
    updated_at: new Date().toISOString(),
  });

  if (error) {
    reportError('security.pin.set', error, { userId: viewer.id });
    return { ok: false, error: 'saveFailed' };
  }

  await unlock(viewer.id, secret);
  return { ok: true };
}

/** Enter the PIN. Five wrong tries lock it for fifteen minutes, in the database. */
export async function unlockAdminPin(_previous: PinState, formData: FormData): Promise<PinState> {
  const viewer = await requireAdmin();
  const secret = stepUpSecret();
  if (!secret) return { ok: false, error: 'unconfigured' };

  const parsed = z.string().trim().safeParse(formData.get('pin'));
  if (!parsed.success || !PIN_PATTERN.test(parsed.data)) return { ok: false, error: 'wrong' };

  if (!(await throttle('admin-pin', 20))) return { ok: false, error: 'rateLimited' };

  const admin = createAdminClient();
  const { data: row } = await admin
    .from('admin_security')
    .select('pin_hash, pin_salt, failed_attempts, locked_until')
    .eq('user_id', viewer.id)
    .maybeSingle();

  // No PIN yet: the screen offers to set one, and this action is not the way in.
  if (!row) return { ok: false, error: 'unconfigured' };

  if (row.locked_until && new Date(row.locked_until).getTime() > Date.now()) {
    return { ok: false, error: 'locked' };
  }

  if (!verifyPin(parsed.data, row.pin_hash, row.pin_salt)) {
    const attempts = row.failed_attempts + 1;
    const locked = attempts >= MAX_ATTEMPTS;
    await admin
      .from('admin_security')
      .update({
        failed_attempts: locked ? 0 : attempts,
        locked_until: locked ? new Date(Date.now() + LOCK_MS).toISOString() : null,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', viewer.id);

    return { ok: false, error: locked ? 'locked' : 'wrong' };
  }

  await admin
    .from('admin_security')
    .update({ failed_attempts: 0, locked_until: null, updated_at: new Date().toISOString() })
    .eq('user_id', viewer.id);

  await unlock(viewer.id, secret);
  return { ok: true };
}

/** Leave the configuration screen locked again. */
export async function lockAdminPin(): Promise<void> {
  (await cookies()).delete(STEPUP_COOKIE);
}
