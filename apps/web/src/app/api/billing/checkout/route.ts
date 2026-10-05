import { NextResponse } from 'next/server';
import { getStripe, priceIds, stripeConfigured } from '@/lib/stripe-server';

/** POST /api/billing/checkout → { url } — create a Stripe Checkout session. */
export async function POST(req: Request) {
  if (!stripeConfigured()) {
    return NextResponse.json({ configured: false, error: 'checkout_not_configured' }, { status: 503 });
  }
  let interval: 'monthly' | 'annual' = 'monthly';
  try {
    const body = (await req.json()) as { interval?: string };
    if (body.interval === 'annual') interval = 'annual';
  } catch {
    /* empty body is fine */
  }
  const prices = priceIds();
  const price = interval === 'annual' ? prices.annual : prices.monthly;
  if (!price) {
    return NextResponse.json({ configured: false, error: 'price_not_configured' }, { status: 503 });
  }

  const origin = process.env.NEXT_PUBLIC_APP_URL ?? new URL(req.url).origin;
  const stripe = getStripe();
  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    line_items: [{ price, quantity: 1 }],
    success_url: `${origin}/settings/plus?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/pricing?canceled=1`,
    allow_promotion_codes: true,
    // No customer data harvested beyond what Stripe Checkout collects itself.
    billing_address_collection: 'auto',
  });

  return NextResponse.json({ configured: true, url: session.url });
}
