import Stripe from 'stripe';

/**
 * Server-only Stripe client. Entitlement webhook/checkout boundary.
 * Env contract (see docs/production/BILLING_ENTITLEMENT.md):
 *   STRIPE_SECRET_KEY         — sk_test_… / sk_live_…
 *   STRIPE_PRICE_PLUS_MONTHLY — price_… (USD 4.99/month)
 *   STRIPE_PRICE_PLUS_ANNUAL  — price_… (USD 29.99/year)
 *   STRIPE_WEBHOOK_SECRET     — whsec_… (for /api/billing/webhook)
 *   NEXT_PUBLIC_APP_URL       — used for success/cancel redirects
 * If STRIPE_SECRET_KEY is unset, every billing route answers 503 so the UI
 * can show the honest "checkout unavailable" state (never fake entitlement).
 */

export function stripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

export function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error('stripe_not_configured');
  return new Stripe(key);
}

export function priceIds(): { monthly?: string; annual?: string } {
  return {
    monthly: process.env.STRIPE_PRICE_PLUS_MONTHLY,
    annual: process.env.STRIPE_PRICE_PLUS_ANNUAL,
  };
}
