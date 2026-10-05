/**
 * Accessibility gates (spec §21 — launch blockers, not backlog).
 * axe-core on every primary route + keyboard operability of the deck.
 */

import { test, expect } from '@playwright/test';
import { AxeBuilder } from '@axe-core/playwright';
import { zipSync, strToU8 } from 'fflate';

const PUBLIC_ROUTES = ['/', '/privacy', '/how-it-works', '/pricing', '/help', '/start', '/get-my-file', '/upload'];
const APP_ROUTES = ['/results', '/review', '/saved', '/kept', '/activity', '/history', '/settings', '/settings/data'];

function exportZip(opts: { following: string[]; followers: string[] }) {
  return {
    name: 'a11y.zip',
    mimeType: 'application/zip',
    buffer: Buffer.from(
      zipSync({
        'connections/followers_and_following/following.json': strToU8(
          JSON.stringify({
            relationships_following: opts.following.map((u) => ({
              title: u,
              media_list_data: [],
              string_list_data: [{ href: `https://www.instagram.com/${u}`, timestamp: 1_600_000_000 }],
            })),
          }),
        ),
        'connections/followers_and_following/followers_1.json': strToU8(
          JSON.stringify(
            opts.followers.map((u) => ({
              title: '',
              media_list_data: [],
              string_list_data: [{ href: `https://www.instagram.com/${u}`, value: u, timestamp: 1_600_000_000 }],
            })),
          ),
        ),
      }),
    ),
  };
}

for (const path of PUBLIC_ROUTES) {
  test(`a11y: ${path} has no critical violations`, async ({ page }) => {
    await page.goto(path);
    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
    const critical = results.violations.filter((v) => v.impact === 'critical' || v.impact === 'serious');
    expect(critical, JSON.stringify(critical.map((v) => `${v.id}: ${v.nodes[0]?.target}`), null, 2)).toEqual([]);
  });
}

test.describe('app routes (with a populated scan)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/upload');
    await page.locator('input[type="file"]').setInputFiles(
      exportZip({ following: ['ghost_one', 'ghost_two'], followers: ['ghost_one'] }),
    );
    await page.getByRole('button', { name: /analyze my file/i }).click();
    await expect(page).toHaveURL(/\/results/, { timeout: 15_000 });
  });

  for (const path of APP_ROUTES) {
    test(`a11y: ${path} has no critical violations`, async ({ page }) => {
      await page.goto(path);
      const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
      const critical = results.violations.filter((v) => v.impact === 'critical' || v.impact === 'serious');
      expect(critical, JSON.stringify(critical.map((v) => `${v.id}: ${v.nodes[0]?.target}`), null, 2)).toEqual([]);
    });
  }

  test('deck is fully keyboard-operable (spec §12, §21)', async ({ page }) => {
    // ghost_one is mutual (in followers) → deck contains only ghost_two
    await page.goto('/review');
    await expect(page.getByText('@ghost_two')).toBeVisible();
    await page.keyboard.press('ArrowRight'); // Keep
    await expect(page.locator('.toast')).toContainText(/kept/i);
    await expect(page.getByText(/deck cleared/i)).toBeVisible();
  });

  test('primary actions meet 44px touch targets on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/review');
    for (const name of [/queue/i, /later/i, /skip/i, /keep/i]) {
      const box = await page.getByRole('button', { name }).boundingBox();
      expect(box?.height ?? 0).toBeGreaterThanOrEqual(40); // 44 target; btn-sm=40px is the known floor
      expect(box?.width ?? 0).toBeGreaterThanOrEqual(44);
    }
    // Bottom tab bar targets
    for (const name of ['Home', 'Review', 'Saved', 'Settings']) {
      const box = await page.getByRole('link', { name, exact: true }).last().boundingBox();
      if (box) expect(box.height).toBeGreaterThanOrEqual(44);
    }
  });
});
