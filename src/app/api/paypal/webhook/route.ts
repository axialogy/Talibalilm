import { NextResponse, type NextRequest } from 'next/server';
import { fromPayPalAmount, getPayPalConfig, verifyWebhookSignature } from '@/lib/paypal/client';
import { revokeOrder, settleOrder } from '@/lib/commerce/orders';
import { reportError } from '@/lib/observability/report';

/**
 * PayPal's own account of what happened.
 *
 * The return route already captures and grants, so in the ordinary case this
 * arrives second and does nothing. It exists for the case that matters: the
 * student closes the tab on PayPal's page after approving, never comes back,
 * and their money has moved anyway. Without this they would have paid for
 * nothing.
 *
 * The signature check is not optional and there is no path around it. PayPal
 * has no shared secret to HMAC, so verifying costs a round trip to their API
 * on every delivery — an unverified body is just a stranger claiming a payment
 * completed.
 */
/**
 * Events that mean the money is gone and the access must go with it.
 *
 * The value is the reason written onto the order, in the words the office will
 * read when a student asks why their access stopped.
 */
const REVOKING_EVENTS = new Map<string, string>([
  ['PAYMENT.CAPTURE.REFUNDED', 'refunded through PayPal'],
  ['PAYMENT.CAPTURE.REVERSED', 'payment reversed by PayPal'],
  ['PAYMENT.CAPTURE.DENIED', 'capture denied'],
  ['CUSTOMER.DISPUTE.CREATED', 'payment disputed by the buyer'],
]);

export async function POST(request: NextRequest) {
  const raw = await request.text();

  const config = await getPayPalConfig();
  // 200 rather than an error: PayPal retries anything else for days, and a
  // site with no PayPal configured has nothing to retry into.
  if (!config) return NextResponse.json({ ignored: 'not_configured' });

  const verified = await verifyWebhookSignature({ config, headers: request.headers, rawBody: raw });
  if (!verified) {
    // A forged or misconfigured webhook is worth an alert: it is either an
    // attack or the webhook id is wrong and no notification will ever verify.
    reportError('paypal.webhook.signature', new Error('signature verification failed'));
    return NextResponse.json({ error: 'signature' }, { status: 401 });
  }

  const event = JSON.parse(raw) as {
    event_type?: string;
    resource?: {
      id?: string;
      status?: string;
      custom_id?: string;
      invoice_id?: string;
      amount?: { value?: string; currency_code?: string };
      supplementary_data?: { related_ids?: { order_id?: string } };
    };
  };

  const kind = event.event_type ?? 'unknown';

  // `custom_id` is our own order id, put there when the order was opened. It
  // is the only field here we trust to identify the order, and even then the
  // amount is checked against the row before anything is granted.
  const orderId = event.resource?.custom_id;
  if (!orderId) return NextResponse.json({ ignored: 'no_reference' });

  // The money went back, or never arrived. Access has to follow it. Before
  // these were handled, a refunded student kept their year and a chargeback
  // went unnoticed — `refunded` existed in the enum and was unreachable.
  if (REVOKING_EVENTS.has(kind)) {
    await revokeOrder(orderId, REVOKING_EVENTS.get(kind) ?? kind);
    console.warn('[paypal] revoked access for order', orderId, 'after', kind);
    return NextResponse.json({ revoked: orderId, reason: kind });
  }

  if (kind !== 'PAYMENT.CAPTURE.COMPLETED') {
    return NextResponse.json({ ignored: kind });
  }

  const value = event.resource?.amount?.value;
  const settled = await settleOrder({
    orderId,
    capturedCents: value ? fromPayPalAmount(value) : null,
    currency: event.resource?.amount?.currency_code ?? null,
    captureId: event.resource?.id ?? null,
    status: event.resource?.status ?? 'UNKNOWN',
  });

  // Always 200 once the signature is good: a non-2xx makes PayPal retry, and
  // retrying will not turn a mismatched amount into a matching one.
  return NextResponse.json(settled);
}
