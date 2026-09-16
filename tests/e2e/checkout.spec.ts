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

  test('a module page enrols without asking which module', async ({ page }) => {
    // The card on a module's own page knows the module. It must not ask which
    // cursus or which modules, and choosing a mode must put THAT module in the
    // basket — the failure this catches is a card that silently holds nothing
    // until the student finds the module again in a list.
    await page.goto('/courses/fiqh-al-ibadat#inscription');

    const card = page.locator('#inscription');
    const steps = card.locator('nav[aria-label="Inscription"]');

    // Three steps, not five: the cursus and module-list questions are gone.
    // The headings are asserted rather than the nav labels because below `sm`
    // the labels are hidden and the numbered buttons carry no accessible name.
    await expect(steps.getByRole('button')).toHaveCount(3);
    await expect(card.getByRole('heading', { name: 'Présentiel ou distanciel' })).toBeVisible();
    await expect(card.getByRole('heading', { name: 'Vos modules' })).toHaveCount(0);
    await expect(card.getByRole('heading', { name: 'Votre cursus' })).toHaveCount(0);

    // The mode choice is a submit button; `aria-pressed` is what tells it apart
    // from the step nav above it.
    await card.locator('button[aria-pressed]').filter({ hasText: 'En ligne' }).click();

    // The flow advances to the details step, which is where a first-time
    // student fills in their enrolment.
    await expect(card.getByRole('heading', { name: 'Vos informations' })).toBeVisible();

    // And the module is in the basket: the payment panel is mounted behind
    // the current step and already carries the server-computed total. If the
    // course had not been resolved into its product, that panel would hold the
    // empty-basket message and no figure at all.
    await expect(card.getByText(/300\s*€/).first()).toHaveText(/300\s*€/);
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
