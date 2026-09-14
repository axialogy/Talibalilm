import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * A probe that could not run must never be reported as a refusal.
 *
 * This is the regression test for a false alarm that cost a round. The
 * diagnostics page asked R2 whether it would accept a browser PUT by sending
 * the preflight itself, and the fetch came back `fetch failed` — a transport
 * error, saying only that the QUESTION never arrived. It was printed as "the
 * bucket does not authorise your origin", sending the school to fix a bucket
 * policy that was correct all along, twice.
 *
 * So the probe now has three outcomes, and only two of them are evidence.
 */
describe('checkCors', () => {
  const ORIGIN = 'https://example.org';

  beforeEach(() => {
    vi.resetModules();
    process.env.R2_ACCOUNT_ID = 'account';
    process.env.R2_ACCESS_KEY_ID = 'AKIATEST';
    process.env.R2_SECRET_ACCESS_KEY = 'secret';
    process.env.R2_BUCKET = 'bucket';
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const probe = async () => {
    const { checkCors } = await import('@/lib/storage/r2');
    return checkCors(ORIGIN);
  };

  const answer = (status: number, headers: Record<string, string>) =>
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(null, { status, headers })),
    );

  it('reports `unverifiable` when the request never completed', async () => {
    // The exact shape of the false alarm: Node's fetch rejecting.
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('fetch failed');
      }),
    );

    const result = await probe();
    expect(result.outcome).toBe('unverifiable');
    // The evidence is kept. Our reading of it is not invented.
    expect(result.error).toContain('fetch failed');
  });

  it('reports `allowed` when R2 names our origin back', async () => {
    answer(200, {
      'access-control-allow-origin': ORIGIN,
      'access-control-allow-methods': 'PUT',
      'access-control-allow-headers': 'content-type',
    });

    const result = await probe();
    expect(result.outcome).toBe('allowed');
    expect(result.allowHeaders).toBe('content-type');
  });

  it('accepts a wildcard origin', async () => {
    answer(200, { 'access-control-allow-origin': '*' });
    expect((await probe()).outcome).toBe('allowed');
  });

  it('reports `refused` when R2 answers and does not name us', async () => {
    answer(403, {});
    const result = await probe();
    expect(result.outcome).toBe('refused');
    expect(result.status).toBe(403);
  });

  it('reports `refused` for a 200 carrying no CORS headers at all', async () => {
    // The quiet failure: a response that looks fine and permits nothing.
    answer(200, {});
    expect((await probe()).outcome).toBe('refused');
  });

  it('reports `unverifiable` rather than a refusal when R2 is not configured', async () => {
    vi.resetModules();
    process.env.R2_BUCKET = '';
    const { checkCors } = await import('@/lib/storage/r2');
    const result = await checkCors(ORIGIN);
    expect(result.configured).toBe(false);
    expect(result.outcome).toBe('unverifiable');
  });
});
