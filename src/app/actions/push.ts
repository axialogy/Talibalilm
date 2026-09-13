'use server';

import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { supabaseConfigured } from '@/lib/env';
import { reportError } from '@/lib/observability/report';

/**
 * Registering a device for notifications.
 *
 * These write through the ORDINARY client, not the service role, and that is
 * the whole design: the row belongs to `auth.uid()`, the policy on
 * `push_subscriptions` says so, and nothing here has to be trusted to get the
 * ownership check right because the database already refuses a row addressed
 * to somebody else.
 *
 * The endpoint comes from the browser, which makes it exactly the kind of input
 * that must never reach a privileged client.
 */

export interface PushState {
  ok: boolean;
  /** A key under `admin.push`, resolved by the component. */
  error?: 'notSignedIn' | 'saveFailed';
}

const subscriptionSchema = z.object({
  // Push services hand out long URLs; the cap is a sanity bound, not a rule
  // from the spec.
  endpoint: z.string().url().max(2000),
  p256dh: z.string().min(1).max(512),
  auth: z.string().min(1).max(512),
  userAgent: z.string().max(400).optional(),
});

export async function savePushSubscription(input: unknown): Promise<PushState> {
  if (!supabaseConfigured) return { ok: false, error: 'saveFailed' };

  const parsed = subscriptionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'saveFailed' };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'notSignedIn' };

  // Re-subscribing on the same device returns the SAME endpoint, so this has to
  // be an upsert on it. An insert would collide with the unique index, and a
  // delete-then-insert would lose the subscription for as long as the two
  // statements take if the second one fails.
  const { error } = await supabase.from('push_subscriptions').upsert(
    {
      user_id: user.id,
      endpoint: parsed.data.endpoint,
      p256dh: parsed.data.p256dh,
      auth: parsed.data.auth,
      user_agent: parsed.data.userAgent ?? null,
    },
    { onConflict: 'endpoint' },
  );

  if (error) {
    reportError('push.save', error, { userId: user.id });
    return { ok: false, error: 'saveFailed' };
  }
  return { ok: true };
}

export async function removePushSubscription(endpoint: string): Promise<PushState> {
  if (!supabaseConfigured) return { ok: false, error: 'saveFailed' };

  const parsed = z.string().url().max(2000).safeParse(endpoint);
  if (!parsed.success) return { ok: false, error: 'saveFailed' };

  const supabase = await createClient();

  // No ownership check here on purpose: `push_delete_own` makes a row belonging
  // to somebody else invisible, so this deletes nothing rather than deleting
  // theirs. The policy is the check.
  const { error } = await supabase.from('push_subscriptions').delete().eq('endpoint', parsed.data);

  if (error) {
    reportError('push.remove', error);
    return { ok: false, error: 'saveFailed' };
  }
  return { ok: true };
}
