import { NextResponse } from 'next/server';
import { stripeConfigured } from '@/lib/stripe-server';

/** GET /api/billing/status → { configured } — lets the UI tell truth about checkout availability. */
export async function GET() {
  return NextResponse.json({ configured: stripeConfigured() });
}
