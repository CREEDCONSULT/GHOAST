import { NextResponse } from 'next/server';
import { getStripe, stripeConfigured } from '@/lib/stripe-server';

/**
 * POST /api/billing/webhook — Stripe lifecycle events.
 * Because entitlement is device-local by design (no user accounts), the
 * webhook's current job is observability + future revocation signals; the
 * client rechecks on demand via /api/billing/verify. Returns 200 always
 * for configured endpoints to avoid Stripe retry storms on benign events.
 */
export async function POST(req: Request) {
  if (!stripeConfigured() || !process.env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ configured: false }, { status: 503 });
  }
  const stripe = getStripe();
  const signature = req.headers.get('stripe-signature') ?? '';
  const payload = await req.text();
  try {
    const event = stripe.webhooks.constructEvent(payload, signature, process.env.STRIPE_WEBHOOK_SECRET);
    // Handled events logged server-side only; nothing user-identifying is stored by us.
    if (
      event.type === 'customer.subscription.deleted' ||
      event.type === 'customer.subscription.updated' ||
      event.type === 'checkout.session.completed'
    ) {
      console.info('[billing] event', event.type);
    }
  } catch {
    return NextResponse.json({ error: 'bad_signature' }, { status: 400 });
  }
  return NextResponse.json({ received: true });
}
