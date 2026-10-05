import { test, expect } from '@playwright/test';

test.describe('landing + public pages', () => {
  test('landing renders headline, CTA and trust strip', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Your Instagram has ghosts.');
    await expect(page.getByRole('link', { name: /find my ghosts/i }).first()).toBeVisible();
    await expect(page.getByText('No Instagram login')).toBeVisible();
    await expect(page.getByText('Processed on your device')).toBeVisible();
    // No fabricated stats: no follower counts or fake dashboards
    await expect(page.getByText(/password/i).first()).toBeVisible();
  });

  test('privacy page states the architecture promise', async ({ page }) => {
    await page.goto('/privacy');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(/plain language/i);
    await expect(page.getByText(/never uploaded/i).first()).toBeVisible();
  });

  test('help page answers the credential question', async ({ page }) => {
    await page.goto('/help');
    await page.getByText(/do you need my instagram password/i).click();
    await expect(page.getByText(/never/i).first()).toBeVisible();
  });
});
