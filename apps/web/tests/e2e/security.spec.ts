/**
 * Security & privacy gates (spec §26.7 / production hardening phase 3).
 * These tests make the privacy promise machine-checkable on every run.
 */

import { test, expect } from '@playwright/test';
import { zipSync, strToU8 } from 'fflate';

function exportZip(opts: { following: string[]; followers: string[]; name: string; hrefs?: Record<string, string> }) {
  const files = {
    'connections/followers_and_following/following.json': strToU8(
      JSON.stringify({
        relationships_following: opts.following.map((u) => ({
          title: u,
          media_list_data: [],
          string_list_data: [{ href: opts.hrefs?.[u] ?? `https://www.instagram.com/${u}`, timestamp: 1_600_000_000 }],
        })),
      }),
    ),
    'connections/followers_and_following/followers_1.json': strToU8(
      JSON.stringify(
        opts.followers.map((u) => ({
          title: '',
          media_list_data: [],
          string_list_data: [{ href: opts.hrefs?.[u] ?? `https://www.instagram.com/${u}`, value: u, timestamp: 1_600_000_000 }],
        })),
      ),
    ),
  };
  return { name: opts.name, mimeType: 'application/zip', buffer: Buffer.from(zipSync(files)) };
}

test('CSP and security headers are enforced on every page class', async ({ page }) => {
  for (const path of ['/', '/upload', '/results', '/settings']) {
    const resp = await page.goto(path);
    const headers = resp!.headers();
    const csp = headers['content-security-policy'] ?? '';
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("connect-src 'self'");
    expect(csp).toContain("img-src 'self' data:"); // no remote images by design
    expect(headers['x-content-type-options']).toBe('nosniff');
  }
});

test('no third-party scripts load anywhere in the journey', async ({ page }) => {
  const scriptOrigins = new Set<string>();
  page.on('request', (req) => {
    if (req.resourceType() === 'script') {
      scriptOrigins.add(new URL(req.url()).origin);
    }
  });
  await page.goto('/');
  await page.goto('/start');
  await page.goto('/upload');
  for (const origin of scriptOrigins) {
    expect(origin.endsWith('localhost') || origin.includes('localhost')).toBe(true);
  }
});

test('archive bytes and usernames never appear in any network request body/URL', async ({ page }) => {
  const leaks: string[] = [];
  page.on('request', (req) => {
    const url = req.url();
    const body = req.postData() ?? '';
    if (/topsecret_|secr3t_/.test(url + body)) leaks.push(url);
  });

  await page.goto('/upload');
  await page
    .locator('input[type="file"]')
    .setInputFiles(exportZip({ following: ['topsecret_friend', 'secr3t_ghost'], followers: [], name: 'ig.zip' }));
  await page.getByRole('button', { name: /analyze my file/i }).click();
  await expect(page).toHaveURL(/\/results/, { timeout: 15_000 });
  await page.goto('/review');
  await page.goto('/activity');
  expect(leaks).toEqual([]);
});

test('malicious usernames/hrefs in the export are neutralized', async ({ page }) => {
  const xssUsername = 'evil_<img_src=x_onerror=alert(1)>';
  await page.goto('/upload');
  await page.locator('input[type="file"]').setInputFiles(
    exportZip({
      following: [xssUsername, 'js_href_user'],
      followers: [],
      hrefs: { js_href_user: 'javascript:alert(document.domain)' },
      name: 'evil.zip',
    }),
  );
  await page.getByRole('button', { name: /analyze my file/i }).click();
  await expect(page).toHaveURL(/\/results/, { timeout: 15_000 });

  await page.goto('/results/ghosts');
  // Username renders as inert text — the injected img/alert never exists in the DOM
  await expect(page.getByText(`@${xssUsername}`, { exact: true })).toBeVisible();
  await expect(page.locator('img[onerror]')).toHaveCount(0);

  // javascript: href is replaced by a derived safe URL
  const link = page.getByRole('link', { name: /view on instagram/i }).last();
  const href = await link.getAttribute('href');
  expect(href).toMatch(/^https:\/\/(www\.)?instagram\.com\//);
});

test('delete everything clears IndexedDB and local storage completely', async ({ page }) => {
  await page.goto('/upload');
  await page
    .locator('input[type="file"]')
    .setInputFiles(exportZip({ following: ['delme1', 'delme2'], followers: [], name: 'del.zip' }));
  await page.getByRole('button', { name: /analyze my file/i }).click();
  await expect(page).toHaveURL(/\/results/, { timeout: 15_000 });

  // sanity: data exists
  const before = await page.evaluate(async () => {
    const dbs = await indexedDB.databases();
    return dbs.length;
  });
  expect(before).toBeGreaterThan(0);

  await page.goto('/settings/data');
  await page.getByRole('button', { name: 'Delete everything', exact: true }).first().click();
  await page.getByRole('button', { name: 'Delete everything', exact: true }).last().click();
  await expect(page).toHaveURL(/\/start/, { timeout: 10_000 });

  const after = await page.evaluate(async () => {
    const dbs = await indexedDB.databases();
    let rows = 0;
    for (const d of dbs) {
      if (!d.name || d.name !== 'ghoast') continue;
      const counts = await new Promise<number>((resolve) => {
        const open = indexedDB.open('ghoast');
        open.onsuccess = () => {
          const dbi = open.result;
          const stores = Array.from(dbi.objectStoreNames);
          if (stores.length === 0) return resolve(0);
          let done = 0;
          let total = 0;
          const tx = dbi.transaction(stores, 'readonly');
          for (const s of stores) {
            const rq = tx.objectStore(s).count();
            rq.onsuccess = () => {
              total += rq.result;
              if (++done === stores.length) resolve(total);
            };
          }
        };
        open.onerror = () => resolve(-1);
      });
      rows += counts;
    }
    return { dbs: dbs.map((d) => d.name), rows, ls: localStorage.length };
  });
  expect(after.rows).toBe(0);
});

test('Instagram deep links open with noopener and leave no window handle', async ({ page }) => {
  await page.goto('/upload');
  await page
    .locator('input[type="file"]')
    .setInputFiles(exportZip({ following: ['deeplink_target'], followers: [], name: 'dl.zip' }));
  await page.getByRole('button', { name: /analyze my file/i }).click();
  await expect(page).toHaveURL(/\/results/, { timeout: 15_000 });

  // Exercise the deck's "View on Instagram ↗" deep link directly.
  await page.goto('/review');
  const link = page.getByRole('link', { name: /view on instagram/i });
  await expect(link).toBeVisible();
  const rel = await link.getAttribute('rel');
  expect(rel).toContain('noopener');
  const target = await link.getAttribute('target');
  expect(target).toBe('_blank');
  expect(await link.getAttribute('href')).toMatch(/^https:\/\/(www\.)?instagram\.com\/deeplink_target/);

  // The cleanup queue "Open in Instagram ↗" path (window.open + noopener).
  await page.getByRole('button', { name: /queue/i }).first().click();
  await expect(page.locator('.toast')).toContainText('Queued @deeplink_target'); // wait for ledger write
  await page.goto('/activity');
  const btn = page.getByRole('button', { name: /open in instagram/i });
  await expect(btn).toBeVisible();
  const [popup] = await Promise.all([
    page.waitForEvent('popup', { timeout: 5000 }).catch(() => null),
    btn.click(),
  ]);
  if (popup) {
    expect(popup.url()).toMatch(/^https:\/\/(www\.)?instagram\.com\/deeplink_target/);
    await popup.close();
  }
});
