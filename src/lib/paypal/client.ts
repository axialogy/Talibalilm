import 'server-only';
import { createAdminClient } from '@/lib/supabase/server';
import { supabaseConfigured } from '@/lib/env';
import { fromPayPalAmount, toPayPalAmount } from './amount';
import type { PayPalPublicConfig } from './types';

export { fromPayPalAmount, toPayPalAmount };
export type { PayPalPublicConfig };

/**
 * PayPal, server-side only.
 *
 * Nothing here may be imported from a Client Component: it holds the client
 * secret, and PayPal's secret is the one that can move money. The whole flow
 * is deliberately server-to-server — the student is redirected to PayPal's own
 * approval page rather than the browser SDK being loaded, so no key, no amount
 * and no order id is ever sitting in the page for a script to alter.
 *
 * Where the credentials come from, in order:
 *   1. Environment variables. A key in Vercel's encrypted store beats a key in
 *      a database row, so this wins when it is set.
 *   2. `payment_settings`, which the school fills in from the admin screen.
 *
 * The secret column carries no grant for `authenticated` at all, so it is read
 * here through the service role and nowhere else.
 */

export interface PayPalConfig {
  environment: 'sandbox' | 'live';
  clientId: string;
  clientSecret: string;
  webhookId: string;
  currency: string;
}

const API = {
  sandbox: 'https://api-m.sandbox.paypal.com',
  live: 'https://api-m.paypal.com',
} as const;

export function apiBase(environment: PayPalConfig['environment']): string {
  return API[environment];
}

function fromEnvironment(): PayPalConfig | null {
  const clientId = process.env.PAYPAL_CLIENT_ID;
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;

  return {
    environment: process.env.PAYPAL_ENVIRONMENT === 'live' ? 'live' : 'sandbox',
    clientId,
    clientSecret,
    webhookId: process.env.PAYPAL_WEBHOOK_ID ?? '',
    currency: process.env.PAYPAL_CURRENCY ?? 'EUR',
  };
}

/**
 * What the browser needs to load PayPal's buttons.
 *
 * Only the client id, the currency and the environment — the client id is
 * public by design and is the one thing the SDK cannot work without. The
 * secret stays here: this function exists so the payment component can be
 * handed exactly these three fields and never the config itself.
 */
export async function getPayPalPublicConfig(): Promise<PayPalPublicConfig | null> {
  const config = await getPayPalConfig();
  if (!config) return null;
  return {
    clientId: config.clientId,
    currency: config.currency,
    environment: config.environment,
  };
}

/** Null when PayPal is not configured, which the payment page reports honestly. */
export async function getPayPalConfig(): Promise<PayPalConfig | null> {
  const fromEnv = fromEnvironment();
  if (fromEnv) return fromEnv;
  if (!supabaseConfigured) return null;

  const supabase = createAdminClient();
  const { data } = await supabase
    .from('payment_settings')
    .select('environment, client_id, client_secret, webhook_id, currency, enabled')
    .maybeSingle();

  if (!data || !data.enabled || !data.client_id || !data.client_secret) return null;

  return {
    environment: data.environment,
    clientId: data.client_id,
    clientSecret: data.client_secret,
    webhookId: data.webhook_id,
    currency: data.currency,
  };
}

/**
 * An access token, fetched per call.
 *
 * Not cached, on purpose. Holding a bearer token in module scope on a
 * serverless runtime means it outlives the request inside a container that
 * goes on to serve someone else, and PayPal's tokens are cheap. Correctness
 * over a round trip.
 */
async function accessToken(config: PayPalConfig): Promise<string> {
  const basic = Buffer.from(`${config.clientId}:${config.clientSecret}`).toString('base64');

  const response = await fetch(`${apiBase(config.environment)}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${basic}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
    cache: 'no-store',
  });

  if (!response.ok) throw new Error(`PayPal refused the credentials (${response.status})`);

  const body = (await response.json()) as { access_token?: string };
  if (!body.access_token) throw new Error('PayPal returned no access token');
  return body.access_token;
}

export interface CreatedOrder {
  id: string;
  approveUrl: string;
}

/**
 * Open the order at PayPal and return where to send the student.
 *
 * The amount is passed in by a caller that has just recomputed it from the
 * catalogue. Nothing that reached us from a browser contributes to it.
 *
 * NO `payment_source` HERE, deliberately. An order created with one is an
 * Expanded Checkout order: its HATEOAS link is `payer-action`, and the buyer
 * must be sent to PayPal's "Review your purchase" page. The site uses the
 * JavaScript SDK's popup instead, and that flow requires a plain order — its
 * link is `approve`. Creating the order with a payment source and approving it
 * through the SDK leaves the order not approved for the capture, which PayPal
 * answers with a 422 on every attempt: "the requested action could not be
 * performed, semantically incorrect, or failed business validation".
 */
export async function createPayPalOrder(options: {
  config: PayPalConfig;
  amountCents: number;
  currency: string;
  /** Our own order id, echoed back on the webhook. */
  referenceId: string;
  description: string;
}): Promise<CreatedOrder> {
  const { config, amountCents, currency, referenceId, description } = options;
  const token = await accessToken(config);

  const response = await fetch(`${apiBase(config.environment)}/v2/checkout/orders`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      // Makes a retried create idempotent at PayPal's end instead of opening a
      // second order for the same basket.
      'PayPal-Request-Id': referenceId,
    },
    cache: 'no-store',
    body: JSON.stringify({
      intent: 'CAPTURE',
      purchase_units: [
        {
          reference_id: referenceId,
          custom_id: referenceId,
          description: description.slice(0, 127),
          amount: { currency_code: currency, value: toPayPalAmount(amountCents) },
        },
      ],
    }),
  });

  const body = (await response.json()) as { id?: string; links?: { href: string; rel: string }[] };

  if (!response.ok || !body.id) {
    throw new Error(`PayPal would not open an order (${response.status})`);
  }

  const approve = body.links?.find((link) => link.rel === 'payer-action' || link.rel === 'approve');
  if (!approve) throw new Error('PayPal returned no approval link');

  return { id: body.id, approveUrl: approve.href };
}

export interface CaptureResult {
  status: string;
  captureId: string | null;
  amountCents: number | null;
  currency: string | null;
  /**
   * Which of PayPal's sources paid: 'paypal' or 'card' (PayPal also reports
   * 'paypal_credit' and others, which are PayPal-funded as far as the school
   * is concerned). Null when PayPal did not say.
   */
  paymentMethod: 'paypal' | 'card' | null;
}

/**
 * PayPal refused the capture, and said why.
 *
 * `issue` is PayPal's own code (`INSTRUMENT_DECLINED`, `ORDER_NOT_APPROVED`,
 * …). It is what the order's failure reason is built from, so the office reads
 * the real cause in Admin → Orders instead of a guess.
 */
export class PayPalRefusal extends Error {
  constructor(
    readonly issue: string,
    readonly detail: string,
  ) {
    super(detail);
    this.name = 'PayPalRefusal';
  }
}

/**
 * The buyer must complete one more step at PayPal before the money can move
 * (a 3-D Secure challenge, a review). The order carries the link to send them
 * to; the caller redirects and captures again when they come back.
 */
export class PayPalPayerAction extends Error {
  constructor(readonly url: string) {
    super('payer action required');
    this.name = 'PayPalPayerAction';
  }
}

interface PayPalOrderBody {
  status?: string;
  payment_source?: Record<string, unknown>;
  purchase_units?: {
    payments?: {
      captures?: {
        id: string;
        status: string;
        amount?: { value: string; currency_code: string };
      }[];
    };
  }[];
  links?: { href: string; rel: string }[];
}

interface PayPalErrorBody {
  name?: string;
  message?: string;
  details?: { issue?: string; description?: string; field?: string }[];
}

/** Read a capture (or an order that already holds one) the same way. */
function readCapture(body: PayPalOrderBody): CaptureResult {
  const capture = body.purchase_units?.[0]?.payments?.captures?.[0];

  // The keys of `payment_source` are the source: `{ card: {...} }` means a
  // card, `{ paypal: {...} }` means the balance. Anything else (a wallet, a
  // credit product) is PayPal-funded and reads as PayPal to the office.
  const sourceKeys = Object.keys(body.payment_source ?? {});
  const paymentMethod: 'paypal' | 'card' | null =
    sourceKeys.length === 0 ? null : sourceKeys.includes('card') ? 'card' : 'paypal';

  return {
    status: capture?.status ?? body.status ?? 'UNKNOWN',
    captureId: capture?.id ?? null,
    amountCents: capture?.amount ? fromPayPalAmount(capture.amount.value) : null,
    currency: capture?.amount?.currency_code ?? null,
    paymentMethod,
  };
}

/** The order as PayPal holds it, or null when it could not be read. */
async function readOrder(
  config: PayPalConfig,
  paypalOrderId: string,
): Promise<PayPalOrderBody | null> {
  const token = await accessToken(config);
  const response = await fetch(
    `${apiBase(config.environment)}/v2/checkout/orders/${encodeURIComponent(paypalOrderId)}`,
    { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' },
  );
  if (!response.ok) return null;
  return (await response.json()) as PayPalOrderBody;
}

/**
 * Take the money. The caller checks the result against its own order row.
 *
 * The 422 body is READ, not assumed. Treating every 422 as "already captured"
 * was how a refused capture became `capture UNKNOWN` on the order — PayPal's
 * actual issue was in the body and was thrown away. Three outcomes now:
 *
 *   * ORDER_ALREADY_CAPTURED — a retry landing on money that already moved.
 *     The order is re-read and its real capture returned, so a paid order can
 *     never be marked failed.
 *   * PAYER_ACTION_REQUIRED — the buyer owes one more step; the caller sends
 *     them to the link and captures on return.
 *   * anything else — `PayPalRefusal` carrying the issue, for the order's
 *     failure reason and the server log.
 */
export async function capturePayPalOrder(
  config: PayPalConfig,
  paypalOrderId: string,
): Promise<CaptureResult> {
  const token = await accessToken(config);

  const response = await fetch(
    `${apiBase(config.environment)}/v2/checkout/orders/${encodeURIComponent(paypalOrderId)}/capture`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'PayPal-Request-Id': `capture-${paypalOrderId}`,
      },
      cache: 'no-store',
    },
  );

  const body = (await response.json().catch(() => ({}))) as PayPalOrderBody & PayPalErrorBody;

  if (!response.ok) {
    // A 5xx is PayPal having a bad moment, not a verdict on this payment. It
    // is thrown as a plain error so the caller leaves the order pending for a
    // retry or the sweep, instead of failing it and releasing its holds.
    if (response.status >= 500) {
      throw new Error(`PayPal answered ${response.status} on the capture`);
    }

    const issue = body.details?.[0]?.issue ?? '';
    const detail =
      [body.name, body.message, body.details?.[0]?.description].filter(Boolean).join(' — ') ||
      `PayPal answered ${response.status}`;

    if (issue === 'ORDER_ALREADY_CAPTURED') {
      const order = await readOrder(config, paypalOrderId);
      if (order) return readCapture(order);
    }

    if (issue === 'PAYER_ACTION_REQUIRED') {
      const order = await readOrder(config, paypalOrderId);
      const url = order?.links?.find((link) => link.rel === 'payer-action')?.href;
      if (url) throw new PayPalPayerAction(url);
    }

    throw new PayPalRefusal(issue || `HTTP ${response.status}`, detail);
  }

  return readCapture(body);
}

/**
 * Is this webhook really from PayPal?
 *
 * PayPal has no shared signing secret to HMAC against — verifying means handing
 * the transmission headers back to PayPal and asking. That is a network call on
 * every delivery, which is worth saying out loud, because the temptation to
 * skip it is exactly how a forged "payment completed" becomes a free year of
 * teaching.
 */
export async function verifyWebhookSignature(options: {
  config: PayPalConfig;
  headers: Headers;
  rawBody: string;
}): Promise<boolean> {
  const { config, headers, rawBody } = options;
  if (!config.webhookId) return false;

  const certUrl = headers.get('paypal-cert-url') ?? '';
  // The cert URL travels in an attacker-controllable header. PayPal checks it
  // too, but refusing anything off their domain before we forward it stops this
  // from becoming a request-forgery lever.
  if (!/^https:\/\/[a-z0-9.-]*\.paypal\.com\//i.test(certUrl)) return false;

  let event: unknown;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return false;
  }

  const payload = {
    auth_algo: headers.get('paypal-auth-algo'),
    cert_url: certUrl,
    transmission_id: headers.get('paypal-transmission-id'),
    transmission_sig: headers.get('paypal-transmission-sig'),
    transmission_time: headers.get('paypal-transmission-time'),
    webhook_id: config.webhookId,
    webhook_event: event,
  };

  if (
    !payload.auth_algo ||
    !payload.transmission_id ||
    !payload.transmission_sig ||
    !payload.transmission_time
  ) {
    return false;
  }

  const token = await accessToken(config);
  const response = await fetch(
    `${apiBase(config.environment)}/v1/notifications/verify-webhook-signature`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      cache: 'no-store',
    },
  );

  if (!response.ok) return false;
  const body = (await response.json()) as { verification_status?: string };
  return body.verification_status === 'SUCCESS';
}
