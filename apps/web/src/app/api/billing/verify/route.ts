import { NextResponse } from 'next/server';
import { getStripe, stripeConfigured } from '@/lib/stripe-server';

/**
 * GET /api/billing/verify?session_id=cs_…
 * Grants entitlement only when Stripe says the session is complete+paid.
 * Also serves as restore/recheck for a previously granted session id.
 */
export async function GET(req: Request) {
  if (!stripeConfigured()) {
    return NextResponse.json({ configured: false, entitled: false }, { status: 503 });
  }
  const sessionId = new URL(req.url).searchParams.get('session_id');
  if (!sessionId || !sessionId.startsWith('cs_')) {
    return NextResponse.json({ configured: true, entitled: false, error: 'bad_session' }, { status: 400 });
  }

  const stripe = getStripe();
  const session = await stripe.checkout.sessions.retrieve(sessionId);
  const paid = session.status === 'complete' && session.payment_status === 'paid';

  let subscriptionActive = false;
  if (paid && session.subscription) {
    const sub = await stripe.subscriptions.retrieve(session.subscription as string);
    subscriptionActive = sub.status === 'active' || sub.status === 'trialing';
  }

  return NextResponse.json({
    configured: true,
    entitled: paid && subscriptionActive,
    stripeSessionId: session.id,
  });
}
