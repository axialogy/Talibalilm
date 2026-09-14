import { expect, test } from '@playwright/test';

/**
 * Two interface locales, French default and unprefixed. Both are LTR now that
 * Arabic has been dropped as a UI language — Arabic survives only as course
 * content, which carries its own `dir` on the element.
 */
test.describe('locale routing', () => {
  test('French is served unprefixed and English under /en', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('lang', 'fr');

    await page.goto('/en');
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  });

  test('switching language keeps you on the same page', async ({ page }) => {
    // The failure this catches is a switcher that always lands on the home
    // page, which is what a naive implementation does.
    await page.goto('/courses/sciences-du-coran');

    // Below `sm` the switcher lives inside the drawer, so open it first. The
    // test runs at both viewports and has to work at either.
    const openDrawer = async () => {
      const menu = page.getByRole('button', { name: /ouvrir le menu|open menu/i });
      if (await menu.isVisible()) await menu.click();
    };

    await openDrawer();
    await page.getByRole('button', { name: /English/ }).click();
    await expect(page).toHaveURL(/\/en\/courses\/sciences-du-coran$/);

    await openDrawer();
    await page.getByRole('button', { name: /Français/ }).click();
    await expect(page).toHaveURL(/\/courses\/sciences-du-coran$/);
  });

  test('English pages are actually translated, not French text under a new lang', async ({
    page,
  }) => {
    await page.goto('/en');
    const h1 = page.getByRole('heading', { level: 1 });
    await expect(h1).toContainText('Islamic sciences');
    await expect(h1).not.toContainText('sciences islamiques');
  });

  test('each locale declares the other as an alternate', async ({ page }) => {
    await page.goto('/courses');
    await expect(page.locator('link[hreflang="en"]')).toHaveAttribute('href', /\/en/);
    await expect(page.locator('link[hreflang="fr"]')).toHaveCount(1);
  });

  test('a dotted path a scanner asks for 404s instead of crashing', async ({ page }) => {
    // The middleware matcher skips anything containing a dot, so the first
    // segment becomes `[locale]` — here `wp-login.php`. The page used to throw
    // a RangeError out of Intl before the layout's notFound() could answer, and
    // the scanner got a 500. The legal page is the deterministic probe: it
    // formats a fixed date whatever the database holds.
    const response = await page.goto('/wp-login.php/legal/terms');
    expect(response?.status()).toBe(404);
  });
});
