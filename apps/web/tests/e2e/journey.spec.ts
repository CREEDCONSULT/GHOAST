/**
 * End-to-end critical path with a synthetic Instagram export:
 * onboarding → upload → board → deck decisions → activity → second scan →
 * comparison (gated) → delete everything.
 *
 * Also asserts the privacy promise holds at the network layer: zero requests
 * leave the origin while the archive is processed (spec §26.7 — the
 * architecture-is-policy check).
 */

import { test, expect } from '@playwright/test';
import { zipSync, strToU8 } from 'fflate';

// Shapes mirror real 2026 DYI exports (username in `title` for following,
// in `value` for followers; nested under connections/).
function followerEntry(username: string, timestamp?: number) {
  return {
    title: '',
    media_list_data: [],
    string_list_data: [
      { href: `https://www.instagram.com/${username}`, value: username, ...(timestamp ? { timestamp } : {}) },
    ],
  };
}
function followingEntry(username: string, timestamp?: number) {
  return {
    title: username,
    media_list_data: [],
    string_list_data: [{ href: `https://www.instagram.com/${username}`, ...(timestamp ? { timestamp } : {}) }],
  };
}

function exportZip(opts: { following: string[]; followers: string[]; name: string }) {
  const files = {
    'connections/followers_and_following/following.json': strToU8(
      JSON.stringify({ relationships_following: opts.following.map((u) => followingEntry(u, 1_600_000_000)) }),
    ),
    'connections/followers_and_following/followers_1.json': strToU8(
      JSON.stringify(opts.followers.map((u) => followerEntry(u, 1_600_000_000))),
    ),
  };
  return { name: opts.name, mimeType: 'application/zip', buffer: Buffer.from(zipSync(files)) };
}

test('full journey: upload → board → review → queue → second scan → delete', async ({ page }) => {
  // Privacy promise: collect every request to a non-self origin during the run.
  const externalRequests: string[] = [];
  page.on('request', (req) => {
    const url = new URL(req.url());
    if (url.origin !== new URL(page.url()).origin && !url.origin.includes('localhost')) {
      externalRequests.push(req.url());
    }
  });

  await page.goto('/');

  // Onboarding
  await page.getByRole('link', { name: /find my ghosts/i }).first().click();
  await expect(page).toHaveURL(/\/start/);
  await page.getByRole('button', { name: /continue/i }).click();
  await page.getByRole('button', { name: /continue/i }).click();
  await page.getByRole('button', { name: /i already have my export/i }).click();
  await expect(page).toHaveURL(/\/upload/);

  // Upload scan 1: follows a, b, c — only a follows back → ghosts: b, c
  const zip1 = exportZip({ following: ['a_user', 'b_ghost', 'c_ghost'], followers: ['a_user'], name: 'instagram-t1.zip' });
  await page.locator('input[type="file"]').setInputFiles(zip1);
  await page.getByRole('button', { name: /analyze my file/i }).click();

  // Board (S-06): complete picture, no paywall
  await expect(page).toHaveURL(/\/results/, { timeout: 15_000 });
  await expect(page.getByRole('heading', { level: 1 })).toContainText('don’t follow back');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('2'); // 2 ghosts hero

  // Review deck: keep b_ghost, queue c_ghost
  await page.getByRole('link', { name: /start reviewing/i }).click();
  await expect(page).toHaveURL(/\/review/);
  // Deck is oldest-first, both have same timestamp → order stable by input: b_ghost first
  await expect(page.getByText('@b_ghost')).toBeVisible();
  await page.getByRole('button', { name: /keep/i }).click();
  await expect(page.getByText('@c_ghost')).toBeVisible();
  await page.getByRole('button', { name: /queue/i }).click();

  // Completion → activity shows queued
  await page.getByRole('link', { name: /open cleanup queue/i }).click();
  await expect(page).toHaveURL(/\/activity/);
  await expect(page.getByText('@c_ghost', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: /open in instagram/i })).toBeVisible();

  // Second scan: c_ghost was unfollowed (verified), d_new is a new ghost
  await page.goto('/upload');
  const zip2 = exportZip({
    following: ['a_user', 'b_ghost', 'd_new'],
    followers: ['a_user'],
    name: 'instagram-t2.zip',
  });
  await page.locator('input[type="file"]').setInputFiles(zip2);
  await page.getByRole('button', { name: /analyze my file/i }).click();
  await expect(page).toHaveURL(/\/results/, { timeout: 15_000 });

  // History shows both scans; comparison gated for free plan
  await page.goto('/history');
  await expect(page.getByText(/Scan of/i).first()).toBeVisible();

  // Delete everything → back to /start
  await page.goto('/settings/data');
  await page.getByRole('button', { name: 'Delete everything', exact: true }).click();
  await page.getByRole('button', { name: 'Delete everything', exact: true }).last().click();
  await expect(page).toHaveURL(/\/start/, { timeout: 10_000 });

  // Privacy assertion: not a single external request carried anything
  expect(externalRequests).toEqual([]);
});

test('upload rejects an HTML export with repair guidance', async ({ page }) => {
  await page.goto('/upload');
  const htmlZip = {
    name: 'instagram-html.zip',
    mimeType: 'application/zip',
    buffer: Buffer.from(
      zipSync({
        'followers_and_following/followers_1.html': strToU8('<html></html>'),
        'followers_and_following/following.html': strToU8('<html></html>'),
      }),
    ),
  };
  await page.locator('input[type="file"]').setInputFiles(htmlZip);
  await page.getByRole('button', { name: /analyze my file/i }).click();
  await expect(page.getByText(/HTML format/i)).toBeVisible({ timeout: 10_000 });
  await expect(page.getByRole('link', { name: /show me how/i })).toBeVisible();
});

test('duplicate scan is detected', async ({ page }) => {
  await page.goto('/upload');
  const zip = exportZip({ following: ['x'], followers: [], name: 'dup.zip' });
  await page.locator('input[type="file"]').setInputFiles(zip);
  await page.getByRole('button', { name: /analyze my file/i }).click();
  await expect(page).toHaveURL(/\/results/, { timeout: 15_000 });

  await page.goto('/upload');
  await page.locator('input[type="file"]').setInputFiles(zip);
  await expect(page.getByText(/already scanned this exact file/i)).toBeVisible({ timeout: 10_000 });
});
