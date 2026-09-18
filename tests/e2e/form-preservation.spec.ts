import { expect, test } from '@playwright/test';

/**
 * A validation error must not throw away the rest of the form.
 *
 * React 19 resets the uncontrolled inputs of any `<form action={fn}>` when the
 * action finishes — including when it finishes by returning field errors. The
 * person then reads "these passwords do not match" under a form they have to
 * fill in again from the first box. The shared ActionForm opts out of that
 * reset; this test keeps the opt-out honest.
 *
 * The mismatch is checked before the action touches Supabase, so this runs
 * anywhere — the rate limiter fails open and the validation returns first.
 */
test('a validation error keeps every field that was filled', async ({ page }) => {
  await page.goto('/register');

  await page.locator('input[name="fullName"]').fill('Amina Test');
  await page.locator('input[name="email"]').fill('amina.e2e@test.fr');
  await page.locator('input[name="password"]').fill('MotDePasse!2345');
  await page.locator('input[name="passwordConfirm"]').fill('AutreMotDePasse!2345');
  await page.locator('input[name="acceptTerms"]').check();

  const form = page.locator('form').filter({ has: page.locator('input[name="passwordConfirm"]') });
  await form.locator('button[type="submit"]').click();

  // The one wrong field is marked...
  await expect(page.locator('input[name="passwordConfirm"]')).toHaveAttribute(
    'aria-invalid',
    'true',
  );

  // ...and nothing else was emptied.
  await expect(page.locator('input[name="fullName"]')).toHaveValue('Amina Test');
  await expect(page.locator('input[name="email"]')).toHaveValue('amina.e2e@test.fr');
  await expect(page.locator('input[name="password"]')).toHaveValue('MotDePasse!2345');
  await expect(page.locator('input[name="passwordConfirm"]')).toHaveValue('AutreMotDePasse!2345');
  await expect(page.locator('input[name="acceptTerms"]')).toBeChecked();
});
