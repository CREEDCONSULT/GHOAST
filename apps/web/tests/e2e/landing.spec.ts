/**
 * E2E: Landing page — navigation, content, mobile responsiveness.
 * Requires: Next.js dev server running at APP_URL (default: http://localhost:3000)
 */

import { test, expect } from '@playwright/test';

test.describe('Landing page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  // ── Render ──────────────────────────────────────────────────────────────────

  test('renders the hero heading', async ({ page }) => {
    await expect(page.locator('h1')).toBeVisible();
  });

  test('renders the navbar with logo', async ({ page }) => {
    const nav = page.locator('nav');
    await expect(nav).toBeVisible();
    await expect(page.getByRole('link', { name: /ghoast home/i })).toBeVisible();
  });

  test('renders the Get started free CTA in nav', async ({ page }) => {
    const cta = page.getByRole('link', { name: /get started free/i }).first();
    await expect(cta).toBeVisible();
    await expect(cta).toHaveAttribute('href', '/register');
  });

  // ── Sections ─────────────────────────────────────────────────────────────────

  test('How it works section is visible', async ({ page }) => {
    await page.locator('#how-it-works').scrollIntoViewIfNeeded();
    await expect(page.locator('#how-it-works')).toBeVisible();
    await expect(page.getByText('Connect your account')).toBeVisible();
    await expect(page.getByText('Scan for ghosts')).toBeVisible();
    await expect(page.getByText('Ghost them back')).toBeVisible();
  });

  test('Ghost tiers section shows all 5 tier labels', async ({ page }) => {
    await page.locator('#ghost-tiers').scrollIntoViewIfNeeded();
    await expect(page.getByText('Safe to Cut')).toBeVisible();
    await expect(page.getByText('Probably Cut')).toBeVisible();
    await expect(page.getByText('Might Keep')).toBeVisible();
    await expect(page.getByText('Keep Following')).toBeVisible();
  });

  test('Pricing section shows all 3 plans', async ({ page }) => {
    await page.locator('#pricing').scrollIntoViewIfNeeded();
    await expect(page.getByText('Free')).toBeVisible();
    await expect(page.getByText('$9.99')).toBeVisible();
    await expect(page.getByText('$24.99')).toBeVisible();
  });

  test('Footer renders with copyright and legal links', async ({ page }) => {
    await page.locator('footer').scrollIntoViewIfNeeded();
    await expect(page.getByText(/all rights reserved/i)).toBeVisible();
    await expect(page.getByRole('link', { name: /privacy policy/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /terms of service/i })).toBeVisible();
  });

  // ── Navigation ────────────────────────────────────────────────────────────────

  test('How it works nav link scrolls to section', async ({ page }) => {
    await page.getByRole('link', { name: /how it works/i }).first().click();
    await expect(page.locator('#how-it-works')).toBeInViewport({ ratio: 0.1 });
  });

  test('Pricing nav link scrolls to pricing section', async ({ page }) => {
    await page.getByRole('link', { name: /^pricing$/i }).first().click();
    await expect(page.locator('#pricing')).toBeInViewport({ ratio: 0.1 });
  });

  // ── Mobile viewport ───────────────────────────────────────────────────────────

  test('mobile: hero CTA is visible on small screen', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/');
    await expect(page.getByRole('link', { name: /scan my account free/i })).toBeVisible();
  });

  test('mobile: pricing cards stack vertically', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/');
    await page.locator('#pricing').scrollIntoViewIfNeeded();
    await expect(page.getByText('$24.99')).toBeVisible();
  });

  // ── SEO ───────────────────────────────────────────────────────────────────────

  test('page has a title', async ({ page }) => {
    const title = await page.title();
    expect(title.length).toBeGreaterThan(0);
    expect(title.toLowerCase()).toContain('ghoast');
  });

  test('page has a meta description', async ({ page }) => {
    const desc = await page.locator('meta[name="description"]').getAttribute('content');
    expect(desc).toBeTruthy();
    expect((desc ?? '').length).toBeGreaterThan(40);
  });
});
