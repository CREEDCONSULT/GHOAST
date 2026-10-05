/**
 * Billing gates (docs/production/BILLING_ENTITLEMENT.md).
 * CI runs without Stripe credentials → the boundary must respond honestly.
 */

import { test, expect } from '@playwright/test';

test('unconfigured billing answers 503, never grants', async ({ request }) => {
  const checkout = await request.post('/api/billing/checkout', { data: {} });
  expect(checkout.status()).toBe(503);
  expect((await checkout.json()).configured).toBe(false);

  const verify = await request.get('/api/billing/verify?session_id=cs_test_fake');
  expect(verify.status()).toBe(503);

  const webhook = await request.post('/api/billing/webhook', { data: {} });
  expect(webhook.status()).toBe(503);
});

test('bad session id is rejected', async ({ request }) => {
  const res = await request.get('/api/billing/verify?session_id=anything');
  // 503 when unconfigured (CI), 400 when configured — never a grant
  expect([400, 503]).toContain(res.status());
});

test('analytics relay rejects non-whitelisted events', async ({ request }) => {
  const ok = await request.post('/api/analytics', {
    data: { event: 'upload_complete', props: { counts_ghosts: 12 }, distinct_id: 'anon-1', ts: Date.now() },
  });
  expect([200, 204]).toContain(ok.status());

  const evil = await request.post('/api/analytics', {
    data: {
      event: 'upload_complete',
      props: { username: 'secret_user', followers_list: ['a', 'b'] },
      distinct_id: 'anon-1',
      ts: Date.now(),
    },
  });
  expect([200, 204]).toContain(evil.status()); // accepted but properties stripped server-side

  const bogus = await request.post('/api/analytics', {
    data: { event: 'exfiltrate_everything', props: {}, distinct_id: 'anon-1' },
  });
  expect(bogus.status()).toBe(400);
});
