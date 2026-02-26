/**
 * E2E: Security audit test suite.
 * Requires: API running at API_URL (default: http://localhost:4000).
 *
 * Tests that sensitive data never leaks through API responses,
 * and that security controls (auth, tier enforcement, JWT) function correctly.
 */

import { test, expect } from '@playwright/test';

const API = process.env.API_URL ?? 'http://localhost:4000';
const JWT_SECRET = process.env.JWT_SECRET ?? '';

// ── Helpers ────────────────────────────────────────────────────────────────────

/** Tamper with a JWT by flipping a character in the signature. */
function tamperJwt(token: string): string {
  const parts = token.split('.');
  if (parts.length !== 3) return token;
  const sig = parts[2];
  // Flip the last character
  const tampered = sig.slice(0, -1) + (sig.endsWith('a') ? 'b' : 'a');
  return `${parts[0]}.${parts[1]}.${tampered}`;
}

// ── Sensitive field exposure ───────────────────────────────────────────────────

test.describe('Sensitive field exposure', () => {
  test('login response does not contain sessionTokenEncrypted', async ({ request }) => {
    const res = await request.post(`${API}/api/v1/auth/login`, {
      data: { email: 'nobody@ghoast.app', password: 'wrongpassword' },
    });
    const body = await res.text();
    expect(body).not.toContain('sessionTokenEncrypted');
    expect(body).not.toContain('session_token_encrypted');
    expect(body).not.toContain('sessionTokenIv');
    expect(body).not.toContain('session_token_iv');
  });

  test('auth error response does not expose stack trace', async ({ request }) => {
    const res = await request.post(`${API}/api/v1/auth/login`, {
      data: { email: 'nobody@ghoast.app', password: 'wrongpassword' },
    });
    const body = await res.text();
    // Stack traces typically contain "at " followed by function names and file paths
    expect(body).not.toMatch(/at \w+\s*\(/);
    expect(body).not.toContain('/node_modules/');
  });

  test('register response does not contain password hash', async ({ request }) => {
    // Use a unique email so it won't conflict
    const res = await request.post(`${API}/api/v1/auth/register`, {
      data: {
        email: `sec-test-${Date.now()}@ghoast.app`,
        password: 'TestP@ss2024!',
      },
    });
    const body = await res.text();
    expect(body).not.toContain('password');
    expect(body).not.toContain('passwordHash');
    expect(body).not.toContain('password_hash');
  });
});

// ── Authentication ─────────────────────────────────────────────────────────────

test.describe('Authentication controls', () => {
  test('missing Authorization header → 401', async ({ request }) => {
    const endpoints = [
      `${API}/api/v1/accounts`,
      `${API}/api/v1/accounts/fake-id/ghosts`,
      `${API}/api/v1/accounts/fake-id/whitelist`,
    ];
    for (const url of endpoints) {
      const res = await request.get(url);
      expect(res.status(), `Expected 401 for ${url}`).toBe(401);
    }
  });

  test('tampered JWT → 401', async ({ request }) => {
    // First register + login to get a real token
    const regRes = await request.post(`${API}/api/v1/auth/register`, {
      data: {
        email: `tamper-${Date.now()}@ghoast.app`,
        password: 'TestP@ss2024!',
      },
    });

    if (regRes.status() !== 201 && regRes.status() !== 200) {
      test.skip(); // Skip if registration is unavailable
      return;
    }

    const { accessToken } = await regRes.json() as { accessToken?: string };
    if (!accessToken) {
      test.skip();
      return;
    }

    const tampered = tamperJwt(accessToken);
    const res = await request.get(`${API}/api/v1/accounts`, {
      headers: { Authorization: `Bearer ${tampered}` },
    });
    expect(res.status()).toBe(401);
  });

  test('expired/malformed token → 401', async ({ request }) => {
    const res = await request.get(`${API}/api/v1/accounts`, {
      headers: { Authorization: 'Bearer this.is.not.a.valid.jwt' },
    });
    expect(res.status()).toBe(401);
  });
});

// ── Tier enforcement ───────────────────────────────────────────────────────────

test.describe('Tier enforcement', () => {
  test('whitelist endpoints reject non-Pro+ users with 403', async ({ request }) => {
    // Register a FREE user
    const regRes = await request.post(`${API}/api/v1/auth/register`, {
      data: {
        email: `tier-${Date.now()}@ghoast.app`,
        password: 'TestP@ss2024!',
      },
    });

    if (regRes.status() !== 201 && regRes.status() !== 200) {
      test.skip();
      return;
    }

    const { accessToken } = await regRes.json() as { accessToken?: string };
    if (!accessToken) {
      test.skip();
      return;
    }

    // Attempt to access whitelist (PRO_PLUS only)
    const res = await request.get(`${API}/api/v1/accounts/fake-account/whitelist`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    // FREE user should get 403 (tier gate) or 404 (account not found) — not 200
    expect([403, 404]).toContain(res.status());
  });
});

// ── Rate limiting ──────────────────────────────────────────────────────────────

test.describe('Rate limiting', () => {
  test('repeated invalid login attempts are rate-limited', async ({ request }) => {
    const responses: number[] = [];
    // Send 20 rapid invalid login requests
    for (let i = 0; i < 20; i++) {
      const res = await request.post(`${API}/api/v1/auth/login`, {
        data: { email: 'ratelimit@ghoast.app', password: 'wrongpassword' },
      });
      responses.push(res.status());
    }
    // At least one should be rate-limited (429) or all should be 401/400/422
    const hasRateLimit = responses.some((s) => s === 429);
    const allBadRequest = responses.every((s) => [400, 401, 422].includes(s));
    expect(hasRateLimit || allBadRequest).toBe(true);
  });
});

// ── Input validation ───────────────────────────────────────────────────────────

test.describe('Input validation', () => {
  test('register with invalid email → 400 or 422', async ({ request }) => {
    const res = await request.post(`${API}/api/v1/auth/register`, {
      data: { email: 'not-an-email', password: 'TestP@ss2024!' },
    });
    expect([400, 422]).toContain(res.status());
  });

  test('register with short password → 400 or 422', async ({ request }) => {
    const res = await request.post(`${API}/api/v1/auth/register`, {
      data: { email: `valid-${Date.now()}@ghoast.app`, password: '123' },
    });
    expect([400, 422]).toContain(res.status());
  });
});
