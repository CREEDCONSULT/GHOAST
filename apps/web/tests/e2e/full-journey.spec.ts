/**
 * E2E: Full user journeys.
 * Requires: Full stack running (Next.js + API + DB + Redis).
 * Use TEST_EMAIL / TEST_PASSWORD env vars to override credentials.
 *
 * These tests simulate real user flows against the running application.
 * In CI: runs with Docker Compose (see .github/workflows/e2e.yml).
 */

import { test, expect, Page } from '@playwright/test';

// ── Helpers ────────────────────────────────────────────────────────────────────

const TEST_EMAIL = process.env.TEST_EMAIL ?? 'e2e-test@ghoast.app';
const TEST_PASSWORD = process.env.TEST_PASSWORD ?? 'TestP@ss2024!';
const API = process.env.API_URL ?? 'http://localhost:4000';

async function registerUser(page: Page, email: string, password: string) {
  await page.goto('/register');
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/password/i).fill(password);
  await page.getByRole('button', { name: /create account|sign up|register/i }).click();
}

async function loginUser(page: Page, email: string, password: string) {
  await page.goto('/login');
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/password/i).fill(password);
  await page.getByRole('button', { name: /log in|sign in/i }).click();
}

// ── Landing → Register ─────────────────────────────────────────────────────────

test.describe('Landing → Register flow', () => {
  test('CTA on landing page navigates to register', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('link', { name: /scan my account free/i }).click();
    await expect(page).toHaveURL(/register/);
  });

  test('Pricing "Get started free" CTA navigates to register', async ({ page }) => {
    await page.goto('/');
    await page.locator('#pricing').scrollIntoViewIfNeeded();
    await page.getByRole('link', { name: /^get started free$/i }).click();
    await expect(page).toHaveURL(/register/);
  });
});

// ── Free user journey ──────────────────────────────────────────────────────────

test.describe('Free user journey', () => {
  // Unique email per test run to avoid conflicts
  const email = `free-${Date.now()}@e2e.ghoast.app`;

  test('register → arrive at dashboard', async ({ page }) => {
    await registerUser(page, email, TEST_PASSWORD);
    // After registration, user should land on the dashboard or onboarding
    await expect(page).toHaveURL(/dashboard|onboard|connect/i, { timeout: 10_000 });
  });

  test('login with valid credentials → dashboard', async ({ page }) => {
    // Pre-condition: user already registered (from previous test or seed)
    await loginUser(page, TEST_EMAIL, TEST_PASSWORD);
    await expect(page).not.toHaveURL('/login', { timeout: 10_000 });
  });

  test('login with wrong password → error message', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel(/email/i).fill('nobody@ghoast.app');
    await page.getByLabel(/password/i).fill('wrongpassword');
    await page.getByRole('button', { name: /log in|sign in/i }).click();
    await expect(page.getByText(/invalid|incorrect|wrong/i)).toBeVisible({ timeout: 5_000 });
  });
});

// ── Pricing page ───────────────────────────────────────────────────────────────

test.describe('Pricing page', () => {
  test('all three plan prices are visible', async ({ page }) => {
    await page.goto('/');
    await page.locator('#pricing').scrollIntoViewIfNeeded();
    await expect(page.getByText('$0')).toBeVisible();
    await expect(page.getByText('$9.99')).toBeVisible();
    await expect(page.getByText('$24.99')).toBeVisible();
  });

  test('Pro CTA navigates to register with plan param', async ({ page }) => {
    await page.goto('/');
    await page.locator('#pricing').scrollIntoViewIfNeeded();
    const proCta = page.getByRole('link', { name: /start pro$/i });
    await expect(proCta).toHaveAttribute('href', '/register?plan=pro');
  });

  test('Pro+ CTA navigates to register with plan param', async ({ page }) => {
    await page.goto('/');
    await page.locator('#pricing').scrollIntoViewIfNeeded();
    const proPlusCta = page.getByRole('link', { name: /start pro\+/i });
    await expect(proPlusCta).toHaveAttribute('href', '/register?plan=proplus');
  });

  test('credit packs show correct prices', async ({ page }) => {
    await page.goto('/');
    await page.locator('#pricing').scrollIntoViewIfNeeded();
    await expect(page.getByText('$2.99')).toBeVisible();
    await expect(page.getByText('$19.99')).toBeVisible();
  });
});

// ── API health ─────────────────────────────────────────────────────────────────

test.describe('API health', () => {
  test('health endpoint returns 200', async ({ request }) => {
    const res = await request.get(`${API}/health`);
    expect(res.status()).toBe(200);
  });

  test('unauthenticated request to protected route returns 401', async ({ request }) => {
    const res = await request.get(`${API}/api/v1/accounts`);
    expect(res.status()).toBe(401);
  });
});
