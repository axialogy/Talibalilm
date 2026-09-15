import { expect, test } from '@playwright/test';

/**
 * The checkout flow.
 *
 * Without a Supabase project the catalogue is empty, so these cover the parts
 * that hold regardless of what is on sale: the step guards, the fact that a
 * basket is never indexed, and that no price is ever carried in the page for a
 * browser to alter. The arithmetic itself is covered exhaustively in
 * tests/unit/quote.test.ts, and the entitlements it produces in
 * supabase/tests/rls_commerce.sql.
 */
test.describe('checkout', () => {
  test('opens on step one and is never indexed', async ({ page }) => {
    await page.goto('/checkout');

    await expect(page.getByRole('heading', { level: 1 })).toContainText('Inscription');
    await expect(page.getByRole('heading', { name: 'Votre cursus' })).toBeVisible();
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
  });

  test('a deep link past the start goes back to the start', async ({ page }) => {
    // The failure this catches is a later step rendering a form with nothing
    // in it, or worse, a total of zero.
    for (const step of ['mode', 'modules', 'review', 'payment']) {
      await page.goto(`/checkout/${step}`);
      await expect(page).toHaveURL(/\/checkout$/);
    }
  });

  test('the flow is translated, not just routed', async ({ page }) => {
    await page.goto('/en/checkout');
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Enrolment');
    await expect(page.getByRole('heading', { name: 'Your cursus' })).toBeVisible();
    await expect(page.getByText('Step 1 of 5')).toBeVisible();
  });

  test('no amount is posted from the browser', async ({ page }) => {
    // Prices are recomputed server-side on every step. A hidden input carrying
    // cents would be a way to pay less, so there must not be one anywhere in
    // the flow.
    await page.goto('/checkout');
    const html = await page.content();
    expect(html).not.toMatch(/name="(price|amount|total|price_cents|total_cents)"/);
  });

  test('the old pricing page now lands on contact', async ({ page }) => {
    // Prices moved onto each module's own page, beside the card that charges
    // them, so /pricing is a permanent redirect rather than a price list that
    // duplicated the catalogue. A hardcoded figure cannot creep back onto a
    // page that no longer exists.
    await page.goto('/pricing');
    await expect(page).toHaveURL(/\/contact$/);
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Contactez-nous');
  });
});
