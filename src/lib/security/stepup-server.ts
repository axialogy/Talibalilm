import 'server-only';
import { cookies } from 'next/headers';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { verifyStepUp } from '@/lib/security/pin';

/**
 * Is this admin past the PIN?
 *
 * Read on the page (to decide whether the configuration form is shown at all)
 * and again in the save action — the form being hidden is presentation, the
 * action's check is the control. A hand-posted request has no cookie.
 *
 * When `STEPUP_SECRET` is unset the lock is CLOSED, not open: the screen says
 * the lock is not configured and refuses to show the credentials form. Fail
 * open would make a missing variable the way in.
 */

export const STEPUP_COOKIE = 'tal_admin_stepup';

export function stepUpSecret(): string | null {
  return process.env.STEPUP_SECRET?.trim() || null;
}

export interface StepUpState {
  /** The signing secret exists. Without it the lock cannot work. */
  configured: boolean;
  /** This admin has set a PIN. */
  pinSet: boolean;
  /** The PIN was entered recently enough, in this browser. */
  unlocked: boolean;
  userId: string | null;
}

export async function stepUpState(): Promise<StepUpState> {
  const secret = stepUpSecret();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { configured: Boolean(secret), pinSet: false, unlocked: false, userId: null };
  }

  const admin = createAdminClient();
  const { data } = await admin
    .from('admin_security')
    .select('user_id')
    .eq('user_id', user.id)
    .maybeSingle();

  const cookie = (await cookies()).get(STEPUP_COOKIE)?.value;

  return {
    configured: Boolean(secret),
    pinSet: data !== null,
    unlocked: secret ? verifyStepUp(cookie, user.id, secret) : false,
    userId: user.id,
  };
}

/** The save-action check. */
export async function stepUpUnlocked(): Promise<boolean> {
  return (await stepUpState()).unlocked;
}
