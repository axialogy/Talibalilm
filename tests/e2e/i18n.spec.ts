import { expect, test } from '@playwright/test';

/**
 * The spec requires French and Arabic from day one, with RTL working — not as
 * a later pass. These tests hold that line.
 */
test.describe('locale routing', () => {
  test('French is served unprefixed and Arabic under /ar', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('lang', 'fr');
    await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');

    await page.goto('/ar');
    await expect(page.locator('html')).toHaveAttribute('lang', 'ar');
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  });

  test('switching language keeps you on the same page', async ({ page }) => {
    // The failure this catches is a switcher that always lands on the home
    // page, which is what a naive implementation does.
    await page.goto('/courses/sciences-du-coran');

    // Below `sm` the switcher lives inside the drawer, so open it first. The
    // test runs at both viewports and has to work at either.
    const openDrawer = async () => {
      const menu = page.getByRole('button', { name: /ouvrir le menu|فتح القائمة/i });
      if (await menu.isVisible()) await menu.click();
    };

    await openDrawer();
    await page.getByRole('button', { name: /العربية/ }).click();

    await expect(page).toHaveURL(/\/ar\/courses\/sciences-du-coran$/);
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');

    await openDrawer();
    await page.getByRole('button', { name: /Français/ }).click();
    await expect(page).toHaveURL(/\/courses\/sciences-du-coran$/);
  });

  test('Arabic pages are actually translated, not French text in an RTL box', async ({ page }) => {
    await page.goto('/ar');
    await expect(page.getByRole('heading', { level: 1 })).toContainText('العلوم الإسلامية');
    await expect(page.getByRole('heading', { level: 1 })).not.toContainText('sciences islamiques');
  });

  test('each locale declares the other as an alternate', async ({ page }) => {
    await page.goto('/courses');
    await expect(page.locator('link[hreflang="ar"]')).toHaveAttribute('href', /\/ar/);
    await expect(page.locator('link[hreflang="fr"]')).toHaveCount(1);
  });
});
