'use client';

/**
 * Billing client — GHOAST+ entitlement.
 *
 * Architecture (see docs/production/BILLING_ENTITLEMENT.md):
 * Stripe Checkout sessions are created/verified by same-origin Next.js API
 * routes. The archive and relationship graph are NEVER involved — the only
 * values crossing the wire are a Stripe session id and a boolean.
 *
 * No fake paid state: if the Stripe env is not configured the API returns
 * 503 and the UI shows "checkout unavailable" instead of granting anything.
 */

import { getSettings, updateSettings } from './store';
import type { SettingsRecord } from './types';

export interface BillingStatus {
  configured: boolean;
  entitled: boolean;
  plan: SettingsRecord['plan'];
  reason?: string;
}

export async function billingConfigured(): Promise<boolean> {
  try {
    const res = await fetch('/api/billing/status', { method: 'GET' });
    if (!res.ok) return false;
    const data = (await res.json()) as { configured?: boolean };
    return data.configured === true;
  } catch {
    return false;
  }
}

/** Redirect to Stripe Checkout. Throws (honestly) when unconfigured. */
export async function startCheckout(interval: 'monthly' | 'annual' = 'monthly'): Promise<void> {
  const res = await fetch('/api/billing/checkout', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ interval }),
  });
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(data.error ?? 'checkout_unavailable');
  }
  const { url } = (await res.json()) as { url: string };
  window.location.assign(url);
}

/**
 * Called on the Checkout success return URL. Grants entitlement ONLY after
 * Stripe confirms the session is paid/complete.
 */
export async function verifyAndGrant(sessionId: string): Promise<BillingStatus> {
  const res = await fetch(`/api/billing/verify?session_id=${encodeURIComponent(sessionId)}`);
  if (!res.ok) return { configured: false, entitled: false, plan: 'free', reason: 'verify_failed' };
  const data = (await res.json()) as {
    configured: boolean;
    entitled: boolean;
    stripeSessionId?: string;
  };
  if (data.configured && data.entitled) {
    await updateSettings({ plan: 'plus', stripeSessionId: data.stripeSessionId ?? sessionId });
    return { configured: true, entitled: true, plan: 'plus' };
  }
  return { configured: data.configured, entitled: false, plan: 'free', reason: 'unpaid' };
}

/** Restore/recheck entitlement (e.g. after reinstall is NOT possible — local data is gone by design; this rechecks an existing record). */
export async function recheckEntitlement(): Promise<BillingStatus> {
  const settings = await getSettings();
  if (settings.plan !== 'plus' || !settings.stripeSessionId) {
    return { configured: true, entitled: false, plan: 'free' };
  }
  return verifyAndGrant(settings.stripeSessionId);
}

/** Downgrade handled honestly: on verify failure of a stored plus plan, revoke locally. */
export async function revokeIfInvalid(): Promise<void> {
  const settings = await getSettings();
  if (settings.plan !== 'plus') return;
  const status = await recheckEntitlement();
  if (!status.entitled) await updateSettings({ plan: 'free', stripeSessionId: null });
}
