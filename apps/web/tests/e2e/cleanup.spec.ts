/**
 * Batch Cleanup Assistant v1 — web e2e (manual driver; extension messaging
 * is covered by apps/extension's unit suite + manifest audit).
 */

import { test, expect } from '@playwright/test';
import { zipSync, strToU8 } from 'fflate';

function exportZip(following: string[], name: string) {
  return {
    name,
    mimeType: 'application/zip',
    buffer: Buffer.from(
      zipSync({
        'connections/followers_and_following/following.json': strToU8(
          JSON.stringify({
            relationships_following: following.map((u) => ({
              title: u,
              media_list_data: [],
              string_list_data: [{ href: `https://www.instagram.com/${u}`, timestamp: 1_600_000_000 }],
            })),
          }),
        ),
        'connections/followers_and_following/followers_1.json': strToU8('[]'),
      }),
    ),
  };
}

test('batch flow: first-N from ghosts list → /cleanup → run manually → done', async ({ page }) => {
  await page.goto('/upload');
  const ghosts = ['g_one', 'g_two', 'g_three', 'g_four', 'g_five', 'g_six', 'g_seven'];
  await page.locator('input[type="file"]').setInputFiles(exportZip(ghosts, 'batch.zip'));
  await page.getByRole('button', { name: /analyze my file/i }).click();
  await expect(page).toHaveURL(/\/results/, { timeout: 15_000 });

  // Ghosts list → pick first 5 of the (default oldest-first) list
  await page.goto('/results/ghosts');
  await expect(page.getByText('@g_one', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '5', exact: true }).click();
  await page.getByRole('button', { name: /add first 5 to cleanup batch/i }).click();

  // /cleanup shows the batch
  await expect(page).toHaveURL(/\/cleanup/);
  await expect(page.getByText(/5 selected/i)).toBeVisible();
  await expect(page.getByText('@g_one', { exact: true })).toBeVisible(); // oldest-first order preserved

  // Start manually — opens Instagram (popup suppressed in test), receipt recorded
  await page.getByRole('button', { name: 'Open in Instagram ↗' }).click();
  await expect(page.getByText(/running/i).first()).toBeVisible();
  await expect(page.getByText(/opened/i).first()).toBeVisible(); // receipt

  // Return-confirm path: simulate user coming back having done it
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(page.getByRole('button', { name: /yes, done/i })).toBeVisible();
  await page.getByRole('button', { name: /yes, done/i }).click();
  await expect(page.getByText(/1 of 5 handled/i)).toBeVisible();
  await expect(page.getByText('@g_two', { exact: true })).toBeVisible(); // cursor advanced

  // Skip one
  await page.getByRole('button', { name: /skip this one/i }).click();
  await expect(page.getByText(/2 of 5 handled/i)).toBeVisible(); // skipped counts toward progress display? completed stays 1 — check receipts instead

  // Stop the batch
  await page.getByRole('button', { name: /stop batch/i }).click();
  await expect(page.getByText(/stopped/i).first()).toBeVisible();

  // Persistence across refresh
  await page.reload();
  await expect(page.getByText(/5 selected/i)).toBeVisible();
});

test('cleanup empty state and nav entry', async ({ page }) => {
  await page.goto('/cleanup');
  await expect(page.getByText('No batch yet')).toBeVisible();
  await page.setViewportSize({ width: 1280, height: 800 });
  await expect(page.getByRole('link', { name: 'Cleanup' })).toBeVisible();
});
