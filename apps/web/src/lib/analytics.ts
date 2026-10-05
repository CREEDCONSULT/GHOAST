'use client';

/**
 * Privacy-safe analytics (docs/production/ANALYTICS_SCHEMA.md).
 *
 * - OPT-IN only (Settings → Analytics), event-level, anonymous.
 * - Events flow through the first-party relay `/api/analytics` (connect-src
 *   'self' stays intact; the relay forwards to PostHog only if configured).
 * - The event names whitelist is enforced HERE and SERVER-SIDE. Properties
 *   are restricted to a small allowlist of non-identifying scalars.
 * - NEVER send: usernames, relationship lists, archive contents, Instagram ids.
 */

import { getSettings } from './store';

export const ALLOWED_EVENTS = [
  'landing_view',
  'export_guide_open',
  'upload_start',
  'upload_complete',
  'upload_error',
  'analysis_complete',
  'triage_start',
  'cleanup_queue_open',
  'reconciliation_complete',
  'comparison_view',
  'paywall_view',
  'checkout_start',
  'checkout_complete',
] as const;

export type AnalyticsEvent = (typeof ALLOWED_EVENTS)[number];

const ALLOWED_PROPS = new Set([
  'error_code', // upload_error: taxonomy code only, never filename/contents
  'counts_following', // aggregate counts only
  'counts_ghosts',
  'reconciled_verified',
  'still_present',
  'duration_ms_bucket', // 'under_1s' | '1_3s' | '3_8s' | 'over_8s' — never exact payloads
  'plan', // 'free' | 'plus'
  'interval', // checkout_start: 'monthly' | 'annual'
]);

let anonIdPromise: Promise<string> | null = null;
async function anonId(): Promise<string> {
  anonIdPromise ??= (async () => {
    const s = await getSettings();
    if (s.analyticsId) return s.analyticsId;
    const id = crypto.randomUUID();
    const { updateSettings } = await import('./store');
    await updateSettings({ analyticsId: id });
    return id;
  })();
  return anonIdPromise;
}

export async function track(
  event: AnalyticsEvent,
  props?: Record<string, string | number>,
): Promise<void> {
  if (!ALLOWED_EVENTS.includes(event)) return;
  try {
    const settings = await getSettings();
    if (settings.analyticsOptIn !== true) return; // default OFF
    const cleanProps: Record<string, string | number> = {};
    for (const [k, v] of Object.entries(props ?? {})) {
      if (ALLOWED_PROPS.has(k)) cleanProps[k] = v;
    }
    await fetch('/api/analytics', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        event,
        props: cleanProps,
        distinct_id: await anonId(),
        ts: Date.now(),
      }),
      keepalive: true,
    });
  } catch {
    // Analytics must never break the product.
  }
}
