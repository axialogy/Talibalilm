import 'server-only';
import { createAdminClient } from '@/lib/supabase/server';
import { formatPrice } from '@/lib/commerce/quote';
import { sendMail } from '@/lib/email/send';
import { orderConfirmation } from '@/lib/email/templates';

/**
 * The receipt.
 *
 * Called after an order is settled, from both the PayPal path and the office
 * path. `claim_confirmation_email` is the lock: it sets `confirmation_sent_at`
 * atomically and returns true to exactly one caller, so a webhook retry racing
 * the return route cannot double-send. If the mailer is not configured, or the
 * send fails, the claim is rolled back so a later run can try again — losing a
 * receipt must never be permanent, but it must also never cost the student
 * their access, which was already granted before this runs.
 */
export async function sendOrderConfirmation(orderId: string): Promise<void> {
  const supabase = createAdminClient();

  const { data: claimed } = await supabase.rpc('claim_confirmation_email', { oid: orderId });
  if (claimed !== true) return; // already sent, or not a paid order

  const { data: order } = await supabase
    .from('orders')
    .select(
      `id, user_id, total_cents, currency, paid_at,
       order_items ( title, schedule_label, duration_days )`,
    )
    .eq('id', orderId)
    .maybeSingle();

  if (!order) {
    await releaseClaim(orderId);
    return;
  }

  const { data: emails } = await supabase.rpc('emails_for', { ids: [order.user_id] });
  const to = emails?.[0]?.email;
  const { data: profile } = await supabase
    .from('profiles')
    .select('locale')
    .eq('id', order.user_id)
    .maybeSingle();
  const locale = profile?.locale === 'en' ? 'en' : 'fr';

  if (!to) {
    await releaseClaim(orderId);
    return;
  }

  const paidAt = order.paid_at ? new Date(order.paid_at) : new Date();
  const dateFmt = new Intl.DateTimeFormat(locale, { dateStyle: 'long' });

  const mail = orderConfirmation({
    to,
    locale,
    orderRef: order.id.slice(0, 8),
    totalLabel: formatPrice(order.total_cents, locale, order.currency),
    items: (order.order_items ?? []).map((i) => ({
      title: i.title,
      scheduleLabel: i.schedule_label,
      untilLabel: dateFmt.format(
        new Date(paidAt.getTime() + i.duration_days * 86_400_000),
      ),
    })),
  });

  const sent = await sendMail(mail);
  if (!sent) await releaseClaim(orderId);
}

/** Let a later run try again. The access is already granted; only the receipt is pending. */
async function releaseClaim(orderId: string): Promise<void> {
  const supabase = createAdminClient();
  await supabase.from('orders').update({ confirmation_sent_at: null }).eq('id', orderId);
}
