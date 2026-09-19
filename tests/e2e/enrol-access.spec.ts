import { expect, test } from '@playwright/test';

/**
 * The module page knows who already holds the module.
 *
 * A student who bought it — or whose paid cursus covers it — must not be shown
 * the checkout again: `has_course_access` is asked on the server, and the
 * enrolment card becomes the way in. A signed-out visitor still sees the
 * enrolment card, because that is the only way to buy.
 *
 * CI only: it creates a student and an entitlement through the service role,
 * which must never happen against a real project.
 */
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;

test.describe('the module page and who holds it', () => {
  test.skip(
    !SUPABASE_URL || !SERVICE_ROLE || !process.env.CI,
    'needs the CI stack: a live Supabase plus the service role',
  );

  const email = `e2e-owner-${Date.now()}@test.fr`;
  const password = 'E2eOwner!2345';
  let userId = '';
  let slug = '';

  const serviceHeaders = {
    apikey: SERVICE_ROLE ?? '',
    Authorization: `Bearer ${SERVICE_ROLE ?? ''}`,
  };

  test.beforeAll(async ({ request }) => {
    const created = await request.post(`${SUPABASE_URL}/auth/v1/admin/users`, {
      headers: { ...serviceHeaders, 'Content-Type': 'application/json' },
      data: {
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name: 'E2E Owner', locale: 'fr' },
      },
    });
    expect(created.ok(), await created.text()).toBeTruthy();
    userId = ((await created.json()) as { id: string }).id;

    const courses = await request.get(
      `${SUPABASE_URL}/rest/v1/courses?select=id,slug&status=eq.published&limit=1`,
      { headers: serviceHeaders },
    );
    expect(courses.ok(), await courses.text()).toBeTruthy();
    const [course] = (await courses.json()) as { id: string; slug: string }[];
    expect(course?.id, 'the seed must contain a published course').toBeTruthy();
    slug = course.slug;

    // A paid year, in effect: the same row the grant path writes.
    const granted = await request.post(`${SUPABASE_URL}/rest/v1/entitlements`, {
      headers: { ...serviceHeaders, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      data: {
        user_id: userId,
        scope: 'course',
        course_id: course.id,
        delivery: 'online',
        expires_at: new Date(Date.now() + 365 * 86_400_000).toISOString(),
      },
    });
    expect(granted.ok(), await granted.text()).toBeTruthy();
  });

  test.afterAll(async ({ request }) => {
    if (!userId) return;
    await request.delete(`${SUPABASE_URL}/auth/v1/admin/users/${userId}`, {
      headers: serviceHeaders,
    });
  });

  test('a signed-out visitor is offered the enrolment', async ({ page }) => {
    await page.goto(`/courses/${slug}`);
    await expect(page.getByText('Inscriptions & paiements')).toBeVisible();
    await expect(page.getByText('Ouvrir le module')).toHaveCount(0);
  });

  test('a student who holds it is offered the way in', async ({ page }) => {
    await page.goto('/login');
    await page.locator('input[name="email"]').fill(email);
    await page.locator('input[name="password"]').fill(password);
    await page.locator('form button[type="submit"]').click();
    await page.waitForURL(/\/dashboard/);

    await page.goto(`/courses/${slug}`);

    await expect(page.getByRole('heading', { name: 'Votre accès' })).toBeVisible();
    const open = page.getByRole('link', { name: 'Ouvrir le module' });
    await expect(open).toBeVisible();
    await expect(open).toHaveAttribute('href', new RegExp(`/dashboard/courses/${slug}/lessons/`));
    await expect(page.getByText('Inscriptions & paiements')).toHaveCount(0);
  });
});
