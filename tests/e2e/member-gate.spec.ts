import { expect, test } from '@playwright/test';

/**
 * The Phase 2 done-criterion: a non-member must not reach lesson content, by
 * page OR by direct API call.
 *
 * The page-level half runs anywhere. The API half needs a live Supabase, so it
 * skips without one — but it is not the only proof: supabase/tests/rls_courses.sql
 * asserts the same boundary against a real Postgres and runs in CI
 * unconditionally. If you change a policy, that file is what fails.
 */
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

test.describe('the member gate — pages', () => {
  test('a signed-out visitor cannot open the learning view', async ({ page }) => {
    await page.goto('/dashboard/courses/fiqh-al-ibadat/lessons/anything');
    await expect(page).toHaveURL(/\/login/);
  });

  test('the public course page ships no video id or playable URL', async ({ page }) => {
    await page.goto('/courses/fiqh-al-ibadat');

    // The syllabus is public by design...
    await expect(page.getByText('Les eaux et les impuretés')).toBeVisible();

    // ...but nothing that could be played. Check the whole payload, not just
    // what is visible: a hidden input or a data attribute would still be a leak.
    const html = await page.content();
    expect(html).not.toMatch(/video_id|videoId/i);
    expect(html).not.toMatch(/\.m3u8|\.mp4|iframe\.mediadelivery|b-cdn\.net/i);
    await expect(page.locator('video, iframe, source')).toHaveCount(0);
  });

  test('the admin area is closed to a signed-out visitor', async ({ page }) => {
    await page.goto('/admin/courses');
    await expect(page).toHaveURL(/\/login/);
  });
});

test.describe('the member gate — REST API', () => {
  test.skip(!SUPABASE_URL || !ANON_KEY, 'needs a live Supabase project');

  test('the anon key cannot read lesson_content beyond previews', async ({ request }) => {
    // Exactly what an attacker would do: skip the app, use the public anon key
    // against PostgREST, and ask for everything.
    const response = await request.get(`${SUPABASE_URL}/rest/v1/lesson_content`, {
      headers: { apikey: ANON_KEY!, Authorization: `Bearer ${ANON_KEY}` },
      params: { select: 'lesson_id,content,video_id' },
    });

    expect(response.ok()).toBeTruthy();
    const rows = (await response.json()) as { video_id: string | null }[];

    // Only preview rows may come back. Anything else means the policy is wrong.
    const previewCheck = await request.get(`${SUPABASE_URL}/rest/v1/lessons`, {
      headers: { apikey: ANON_KEY!, Authorization: `Bearer ${ANON_KEY}` },
      params: { select: 'id', is_preview: 'eq.true' },
    });
    const previewIds = ((await previewCheck.json()) as { id: string }[]).map((l) => l.id);

    expect(rows.length).toBeLessThanOrEqual(previewIds.length);
  });

  test('the anon key cannot grant itself an entitlement', async ({ request }) => {
    const response = await request.post(`${SUPABASE_URL}/rest/v1/entitlements`, {
      headers: {
        apikey: ANON_KEY!,
        Authorization: `Bearer ${ANON_KEY}`,
        'Content-Type': 'application/json',
      },
      data: {
        user_id: '00000000-0000-0000-0000-000000000000',
        scope: 'site',
        expires_at: new Date(Date.now() + 86_400_000).toISOString(),
      },
    });

    // 401/403 from the grant, or 404 because the table is not exposed to anon.
    expect(response.status()).toBeGreaterThanOrEqual(400);
  });

  test('the anon key cannot create an order and name its own total', async ({ request }) => {
    const response = await request.post(`${SUPABASE_URL}/rest/v1/orders`, {
      headers: {
        apikey: ANON_KEY!,
        Authorization: `Bearer ${ANON_KEY}`,
        'Content-Type': 'application/json',
      },
      data: {
        user_id: '00000000-0000-0000-0000-000000000000',
        route: 'paypal',
        delivery: 'online',
        subtotal_cents: 1,
        total_cents: 1,
      },
    });

    expect(response.status()).toBeGreaterThanOrEqual(400);
  });

  test('the anon key cannot read the coupon table', async ({ request }) => {
    // A percent-off code is worth money, and the office batch is worth a year.
    const response = await request.get(`${SUPABASE_URL}/rest/v1/coupons?select=code`, {
      headers: { apikey: ANON_KEY!, Authorization: `Bearer ${ANON_KEY}` },
    });

    expect(response.status()).toBeGreaterThanOrEqual(400);
  });

  test('the anon key cannot read draft courses', async ({ request }) => {
    const response = await request.get(`${SUPABASE_URL}/rest/v1/courses`, {
      headers: { apikey: ANON_KEY!, Authorization: `Bearer ${ANON_KEY}` },
      params: { select: 'slug,status', status: 'eq.draft' },
    });

    expect(response.ok()).toBeTruthy();
    expect(await response.json()).toEqual([]);
  });
});
