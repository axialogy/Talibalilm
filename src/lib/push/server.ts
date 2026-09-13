import 'server-only';
import webpush from 'web-push';
import { createAdminClient } from '@/lib/supabase/server';
import { supabaseConfigured, siteUrl } from '@/lib/env';
import { reportError } from '@/lib/observability/report';

/**
 * Web Push, to whatever devices the school has subscribed.
 *
 * Optional the same way PayPal and SMTP are: with `VAPID_PRIVATE_KEY` unset
 * every send is a logged no-op. A notification is a courtesy — losing it must
 * never lose the registration that triggered it — so nothing here throws.
 *
 * It costs nothing to run. The message goes to the browser vendor's own push
 * service (Google's, Apple's, Mozilla's) on an endpoint that browser gave us,
 * authenticated by a key pair generated once with `npm run push:keys`. No
 * account, no third party, no bill.
 */

export interface PushPayload {
  title: string;
  body: string;
  /** Where a tap should land, as a site-relative path. */
  url: string;
  /**
   * Collapses repeats on the device. Two alerts about the same student replace
   * each other rather than stacking into a wall of identical notifications.
   */
  tag?: string;
}

interface Vapid {
  publicKey: string;
  privateKey: string;
  subject: string;
}

function vapid(): Vapid | null {
  const publicKey = process.env.VAPID_PUBLIC_KEY?.trim();
  const privateKey = process.env.VAPID_PRIVATE_KEY?.trim();
  if (!publicKey || !privateKey) return null;
  // The subject identifies the sender to the push service; it must be a mailto:
  // or https: URL. A push service may refuse a malformed one, so it falls back
  // to the site rather than to an empty string.
  const subject = process.env.VAPID_SUBJECT?.trim() || siteUrl();
  return { publicKey, privateKey, subject };
}

export function pushConfigured(): boolean {
  return vapid() !== null;
}

interface Row {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
}

/**
 * Send to one device, and say whether the subscription is dead.
 *
 * 404 and 410 are the push service telling us the browser threw this
 * subscription away — uninstalled, permission revoked, storage cleared. That is
 * not an error to retry; it is a row to delete, or the table fills with
 * endpoints that can never be delivered to and every send gets slower.
 */
async function sendOne(config: Vapid, row: Row, payload: PushPayload): Promise<boolean> {
  try {
    await webpush.sendNotification(
      {
        endpoint: row.endpoint,
        keys: { p256dh: row.p256dh, auth: row.auth },
      },
      JSON.stringify(payload),
      {
        vapidDetails: {
          subject: config.subject,
          publicKey: config.publicKey,
          privateKey: config.privateKey,
        },
        TTL: 24 * 60 * 60,
      },
    );
    return false;
  } catch (cause) {
    const status = (cause as { statusCode?: number }).statusCode;
    if (status === 404 || status === 410) return true;
    reportError('push.send', cause, { endpoint: row.endpoint.slice(0, 60), status });
    return false;
  }
}

/**
 * Buzz every staff device about something.
 *
 * Read through the ADMIN client, and the reason is worth stating rather than
 * leaving as a shortcut: the person whose request this is, is the student who
 * has just registered. There is no staff session to read staff rows through, so
 * a policy could never allow it. This is the same class of use as the sweep —
 * background, server-side, and not reachable from unvalidated input, since the
 * only thing the caller contributes is a name and an address that Zod has
 * already validated and that end up inside a JSON string, never in a query.
 */
export async function notifyStaff(payload: PushPayload): Promise<void> {
  const config = vapid();
  if (!config) {
    console.warn('[push] VAPID keys not set — would have sent:', payload.title);
    return;
  }
  if (!supabaseConfigured) return;

  try {
    const admin = createAdminClient();

    const { data: staff } = await admin
      .from('profiles')
      .select('id')
      .in('role', ['admin', 'instructor']);
    const ids = (staff ?? []).map((s) => s.id);
    if (ids.length === 0) return;

    const { data: rows } = await admin
      .from('push_subscriptions')
      .select('id, endpoint, p256dh, auth')
      .in('user_id', ids);
    if (!rows || rows.length === 0) return;

    const results = await Promise.all(rows.map((row) => sendOne(config, row as Row, payload)));

    const dead = rows.filter((_, i) => results[i]).map((row) => row.id);
    if (dead.length > 0) {
      await admin.from('push_subscriptions').delete().in('id', dead);
    }
  } catch (cause) {
    reportError('push.notifyStaff', cause, {
      note: 'the thing being announced still happened; only the notification failed',
    });
  }
}

/** The one alert the school asked for: somebody has registered. */
export async function notifyStaffOfRegistration(input: {
  fullName: string;
  email: string;
  userId: string;
}): Promise<void> {
  await notifyStaff({
    title: 'Nouvelle inscription',
    body: `${input.fullName || input.email} vient de créer un compte.`,
    url: input.userId ? `/admin/students/${input.userId}` : '/admin/students',
    // One notification per student, however many times this fires.
    tag: `registration-${input.userId || input.email}`,
  });
}
