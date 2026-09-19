import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  capturePayPalOrder,
  createPayPalOrder,
  PayPalPayerAction,
  PayPalRefusal,
  type PayPalConfig,
} from '@/lib/paypal/client';

/**
 * The two PayPal calls that move money, against a mocked network.
 *
 * The regression these guard: `createPayPalOrder` used to send a
 * `payment_source`, which makes PayPal treat the order as an Expanded Checkout
 * order whose approval belongs to its redirect page — while the page approves
 * through the JS SDK popup. Every capture then came back 422, and the code
 * swallowed the body, so the order read `capture UNKNOWN`. Both halves are
 * asserted here: a plain create, and a capture that reads what PayPal said.
 */

const config: PayPalConfig = {
  environment: 'sandbox',
  clientId: 'client-id',
  clientSecret: 'client-secret',
  webhookId: 'webhook-id',
  currency: 'EUR',
};

interface StubResponse {
  ok?: boolean;
  status?: number;
  json: unknown;
}

/** A fetch that answers from a queue: token call first, then each endpoint. */
function mockFetch(responses: StubResponse[]) {
  const calls: { url: string; init?: RequestInit }[] = [];
  const fn = vi.fn(async (url: string | URL, init?: RequestInit) => {
    calls.push({ url: String(url), init });
    const next = responses.shift();
    if (!next) throw new Error(`unexpected fetch to ${String(url)}`);
    return {
      ok: next.ok ?? true,
      status: next.status ?? 200,
      json: async () => next.json,
    } as Response;
  });
  vi.stubGlobal('fetch', fn);
  return calls;
}

const token = { json: { access_token: 'token' } };

const capturedOrder = {
  status: 'COMPLETED',
  payment_source: { paypal: { email_address: 'payer@example.com' } },
  purchase_units: [
    {
      payments: {
        captures: [
          { id: 'CAPTURE-1', status: 'COMPLETED', amount: { value: '2.00', currency_code: 'EUR' } },
        ],
      },
    },
  ],
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('createPayPalOrder', () => {
  it('creates a plain order — no payment_source, which is what the SDK popup flow requires', async () => {
    const calls = mockFetch([
      token,
      { json: { id: 'PAYPAL-ORDER-1', links: [{ rel: 'approve', href: 'https://paypal/approve' }] } },
    ]);

    const created = await createPayPalOrder({
      config,
      amountCents: 200,
      currency: 'EUR',
      referenceId: 'order-uuid',
      description: 'Tajwid niveau 1',
    });

    expect(created.id).toBe('PAYPAL-ORDER-1');
    const body = JSON.parse(String(calls[1]?.init?.body)) as Record<string, unknown>;
    expect(body).not.toHaveProperty('payment_source');
    expect(body).not.toHaveProperty('application_context');
    expect(body.intent).toBe('CAPTURE');
    expect(body.purchase_units).toEqual([
      {
        reference_id: 'order-uuid',
        custom_id: 'order-uuid',
        description: 'Tajwid niveau 1',
        amount: { currency_code: 'EUR', value: '2.00' },
      },
    ]);
  });
});

describe('capturePayPalOrder', () => {
  it('returns the capture when the money moved', async () => {
    mockFetch([token, { status: 201, json: capturedOrder }]);

    await expect(capturePayPalOrder(config, 'PAYPAL-ORDER-1')).resolves.toEqual({
      status: 'COMPLETED',
      captureId: 'CAPTURE-1',
      amountCents: 200,
      currency: 'EUR',
      paymentMethod: 'paypal',
    });
  });

  it('reads the order when PayPal says it was already captured, so a paid order is never failed', async () => {
    const calls = mockFetch([
      token,
      {
        ok: false,
        status: 422,
        json: { name: 'UNPROCESSABLE_ENTITY', details: [{ issue: 'ORDER_ALREADY_CAPTURED' }] },
      },
      token,
      { json: capturedOrder },
    ]);

    const result = await capturePayPalOrder(config, 'PAYPAL-ORDER-1');

    expect(result.status).toBe('COMPLETED');
    expect(result.captureId).toBe('CAPTURE-1');
    expect(calls[3]?.url).toContain('/v2/checkout/orders/PAYPAL-ORDER-1');
  });

  it('hands back the payer-action link when the buyer owes one more step', async () => {
    mockFetch([
      token,
      { ok: false, status: 422, json: { details: [{ issue: 'PAYER_ACTION_REQUIRED' }] } },
      token,
      { json: { links: [{ rel: 'payer-action', href: 'https://paypal.example/action' }] } },
    ]);

    const thrown = await capturePayPalOrder(config, 'PAYPAL-ORDER-1').catch((error: unknown) => error);
    expect(thrown).toBeInstanceOf(PayPalPayerAction);
    expect((thrown as PayPalPayerAction).url).toBe('https://paypal.example/action');
  });

  it('carries PayPal’s own issue when the capture is refused', async () => {
    mockFetch([
      token,
      {
        ok: false,
        status: 422,
        json: {
          name: 'UNPROCESSABLE_ENTITY',
          message: 'The requested action could not be performed.',
          details: [{ issue: 'INSTRUMENT_DECLINED', description: 'The instrument was declined.' }],
        },
      },
    ]);

    const thrown = await capturePayPalOrder(config, 'PAYPAL-ORDER-1').catch((error: unknown) => error);
    expect(thrown).toBeInstanceOf(PayPalRefusal);
    expect((thrown as PayPalRefusal).issue).toBe('INSTRUMENT_DECLINED');
    expect((thrown as PayPalRefusal).detail).toContain('The instrument was declined.');
  });

  it('leaves a 5xx as a transient error, not a refusal — the order stays pending', async () => {
    mockFetch([token, { ok: false, status: 503, json: {} }]);

    const thrown = await capturePayPalOrder(config, 'PAYPAL-ORDER-1').catch((error: unknown) => error);
    expect(thrown).toBeInstanceOf(Error);
    expect(thrown).not.toBeInstanceOf(PayPalRefusal);
  });
});
