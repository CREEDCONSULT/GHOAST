import { NextResponse } from 'next/server';

/**
 * First-party analytics relay. Forwards ONLY whitelisted event-level data to
 * PostHog when POSTHOG_API_KEY/POSTHOG_HOST are configured; otherwise a no-op
 * 204. The whitelist is enforced server-side as well — an archive payload
 * cannot ride this route.
 */

const ALLOWED_EVENTS = new Set([
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
]);

const ALLOWED_PROPS = new Set([
  'error_code',
  'counts_following',
  'counts_ghosts',
  'reconciled_verified',
  'still_present',
  'duration_ms_bucket',
  'plan',
  'interval',
]);

export async function POST(req: Request) {
  // Validate FIRST — the whitelist applies even when forwarding is disabled.
  let body: { event?: string; props?: Record<string, unknown>; distinct_id?: string; ts?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'bad_request' }, { status: 400 });
  }
  if (!body.event || !ALLOWED_EVENTS.has(body.event) || typeof body.distinct_id !== 'string' || body.distinct_id.length > 64) {
    return NextResponse.json({ error: 'rejected' }, { status: 400 });
  }
  const props: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(body.props ?? {})) {
    if (ALLOWED_PROPS.has(k) && (typeof v === 'string' || typeof v === 'number')) props[k] = v;
  }

  const key = process.env.POSTHOG_API_KEY;
  if (!key) return new NextResponse(null, { status: 204 }); // analytics not configured: accept-and-drop

  const host = process.env.POSTHOG_HOST ?? 'https://app.posthog.com';
  await fetch(`${host}/capture/`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      api_key: key,
      event: body.event,
      distinct_id: body.distinct_id,
      properties: { ...props, $lib: 'ghoast-web/1.0' },
      timestamp: typeof body.ts === 'number' ? new Date(body.ts).toISOString() : undefined,
    }),
  }).catch(() => {
    /* swallow — analytics must never break user flows */
  });
  return new NextResponse(null, { status: 204 });
}
