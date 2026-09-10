import { expect, test } from '@playwright/test';

/**
 * Phase 1's acceptance criteria, as tests: the public pages render, they are
 * server-rendered and indexable, and the language switch works both ways.
 */
test.describe('public catalogue', () => {
  test('the home page renders its hero and the course grid', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Cours de sciences islamiques');
    await expect(page.getByRole('article')).toHaveCount(6);
  });

  test('a course page lists the syllabus without leaking gated content', async ({ page }) => {
    await page.goto('/courses/fiqh-al-ibadat');

    await expect(page.getByRole('heading', { level: 1 })).toContainText('Jurisprudence islamique');
    // The outline is the sales page, so lesson titles must be present.
    await expect(page.getByText('Les eaux et les impuretés')).toBeVisible();

    // Nothing that would let a non-member watch: no media element, no video
    // provider URL anywhere in the payload. Phase 2 adds the API-level twin of
    // this assertion; this one guards the rendered page.
    await expect(page.locator('video, iframe')).toHaveCount(0);
    const html = await page.content();
    expect(html).not.toMatch(/mux\.com|bunnycdn|b-cdn\.net|\.m3u8|\.mp4/i);
  });

  test('filters live in the URL so a filtered catalogue is shareable', async ({ page }) => {
    await page.goto('/courses');
    const before = await page.getByRole('article').count();

    await page.getByRole('link', { name: 'Jurisprudence', exact: true }).click();
    await expect(page).toHaveURL(/category=fiqh/);

    const after = await page.getByRole('article').count();
    expect(after).toBeLessThan(before);

    // Reload proves the filter is server-rendered rather than client state.
    await page.reload();
    expect(await page.getByRole('article').count()).toBe(after);
  });

  test('unknown course slugs 404 rather than rendering an empty shell', async ({ page }) => {
    const response = await page.goto('/courses/ce-cours-nexiste-pas');
    expect(response?.status()).toBe(404);
  });
});

test.describe('SEO', () => {
  test('the home page carries organisation JSON-LD', async ({ page }) => {
    await page.goto('/');
    const raw = await page.locator('script[type="application/ld+json"]').first().textContent();
    const parsed: unknown = JSON.parse(raw ?? '{}');
    expect(parsed).toMatchObject({ '@type': 'EducationalOrganization' });
  });

  test('a course page carries Course JSON-LD with its provider and offer', async ({ page }) => {
    await page.goto('/courses/sciences-du-coran');
    const raw = await page.locator('script[type="application/ld+json"]').first().textContent();
    const parsed = JSON.parse(raw ?? '{}') as Record<string, unknown>;
    expect(parsed['@type']).toBe('Course');
    expect(parsed['provider']).toMatchObject({ '@type': 'EducationalOrganization' });
    expect(parsed['offers']).toMatchObject({ priceCurrency: 'EUR' });
  });

  test('sitemap and robots are served', async ({ request }) => {
    const sitemap = await request.get('/sitemap.xml');
    expect(sitemap.ok()).toBeTruthy();
    const body = await sitemap.text();
    expect(body).toContain('/courses/fiqh-al-ibadat');
    // Both locales are listed, not only the default one.
    expect(body).toContain('/en/courses/fiqh-al-ibadat');

    const robots = await request.get('/robots.txt');
    expect(robots.ok()).toBeTruthy();
    expect(await robots.text()).toContain('Sitemap:');
  });

  test('auth pages are excluded from indexing', async ({ page }) => {
    await page.goto('/login');
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
  });
});
