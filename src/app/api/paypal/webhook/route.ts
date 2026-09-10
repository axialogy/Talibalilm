import { NextResponse, type NextRequest } from 'next/server';
import { fromPayPalAmount, getPayPalConfig, verifyWebhookSignature } from '@/lib/paypal/client';
import { settleOrder } from '@/lib/commerce/orders';

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
export async function POST(request: NextRequest) {
  const raw = await request.text();

  const config = await getPayPalConfig();
  // 200 rather than an error: PayPal retries anything else for days, and a
  // site with no PayPal configured has nothing to retry into.
  if (!config) return NextResponse.json({ ignored: 'not_configured' });

  const verified = await verifyWebhookSignature({ config, headers: request.headers, rawBody: raw });
  if (!verified) {
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

  if (event.event_type !== 'PAYMENT.CAPTURE.COMPLETED') {
    return NextResponse.json({ ignored: event.event_type ?? 'unknown' });
  }

  // `custom_id` is our own order id, put there when the order was opened. It
  // is the only field here we trust to identify the order, and even then the
  // amount is checked against the row before anything is granted.
  const orderId = event.resource?.custom_id;
  if (!orderId) return NextResponse.json({ ignored: 'no_reference' });

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
