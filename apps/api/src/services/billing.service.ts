/**
 * Billing Service
 *
 * Handles all Stripe interactions:
 * - Creating Checkout sessions for subscriptions
 * - Creating Payment Intents for credit packs
 * - Creating Customer Portal sessions
 * - Processing Stripe webhook events (idempotent)
 * - Credit balance management (atomic, transaction-safe)
 *
 * SECURITY:
 * - Stripe signature verified on every webhook (fail hard on invalid)
 * - credit consumption is atomic (Prisma transaction)
 * - stripe_payment_intent_id unique constraint guards idempotency
 * - Never return Stripe secret keys in any response
 */

import Stripe from 'stripe';
import { prisma } from '@ghoast/db';
import type { UserTier } from '@ghoast/db';
import { logger } from '../lib/logger.js';

// ── Stripe client (lazy-initialized so tests that don't need Stripe can still
//    import server.ts without STRIPE_SECRET_KEY being set) ────────────────────

let _stripeClient: Stripe | null = null;

function getStripeClient(): Stripe {
  if (!_stripeClient) {
    if (!process.env.STRIPE_SECRET_KEY) {
      throw new Error('STRIPE_SECRET_KEY environment variable is required');
    }
    _stripeClient = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: '2024-06-20',
    });
  }
  return _stripeClient;
}

// ── Error types ───────────────────────────────────────────────────────────────

export class InvalidWebhookSignatureError extends Error {
  constructor() {
    super('Invalid Stripe webhook signature.');
    this.name = 'InvalidWebhookSignatureError';
  }
}

export class UserNotFoundError extends Error {
  constructor() {
    super('User not found.');
    this.name = 'UserNotFoundError';
  }
}

export class InsufficientCreditsError extends Error {
  constructor() {
    super('Insufficient credit balance.');
    this.name = 'InsufficientCreditsError';
  }
}

// ── Credit pack definitions ───────────────────────────────────────────────────

interface CreditPack {
  priceId: string;
  credits: number;
  packType: 'starter' | 'standard' | 'power';
}

function getCreditPacks(): CreditPack[] {
  return [
    {
      priceId: process.env.STRIPE_PRICE_CREDITS_100 ?? '',
      credits: 100,
      packType: 'starter',
    },
    {
      priceId: process.env.STRIPE_PRICE_CREDITS_500 ?? '',
      credits: 500,
      packType: 'standard',
    },
    {
      priceId: process.env.STRIPE_PRICE_CREDITS_1500 ?? '',
      credits: 1500,
      packType: 'power',
    },
  ];
}

// ── Checkout helpers ──────────────────────────────────────────────────────────

async function getOrCreateStripeCustomer(userId: string): Promise<string> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, stripeCustomerId: true },
  });

  if (!user) throw new UserNotFoundError();
  if (user.stripeCustomerId) return user.stripeCustomerId;

  const customer = await getStripeClient().customers.create({
    email: user.email,
    metadata: { ghoast_user_id: userId },
  });

  await prisma.user.update({
    where: { id: userId },
    data: { stripeCustomerId: customer.id },
  });

  return customer.id;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Creates a Stripe Checkout session for a Pro or Pro+ subscription.
 * Returns the checkout session URL for the client to redirect to.
 */
export async function createSubscribeCheckout(
  userId: string,
  tier: 'PRO' | 'PRO_PLUS',
  successUrl: string,
  cancelUrl: string,
): Promise<string> {
  const priceId =
    tier === 'PRO'
      ? process.env.STRIPE_PRICE_PRO_MONTHLY
      : process.env.STRIPE_PRICE_PROPLUS_MONTHLY;

  if (!priceId) {
    throw new Error(`Stripe price ID for ${tier} not configured`);
  }

  const customerId = await getOrCreateStripeCustomer(userId);

  const session = await getStripeClient().checkout.sessions.create({
    customer: customerId,
    mode: 'subscription',
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata: { ghoast_user_id: userId },
  });

  if (!session.url) throw new Error('Stripe did not return a checkout URL');
  return session.url;
}

/**
 * Creates a Stripe Payment Intent for a credit pack purchase.
 * Returns the client_secret for the frontend to complete payment.
 */
export async function createCreditPaymentIntent(
  userId: string,
  priceId: string,
): Promise<{ clientSecret: string; packType: string; credits: number }> {
  const packs = getCreditPacks();
  const pack = packs.find((p) => p.priceId === priceId);
  if (!pack) throw new Error('Invalid credit pack price ID');

  const customerId = await getOrCreateStripeCustomer(userId);

  // Retrieve the price to get the amount
  const price = await getStripeClient().prices.retrieve(priceId);
  if (!price.unit_amount) throw new Error('Could not determine price amount');

  const paymentIntent = await getStripeClient().paymentIntents.create({
    amount: price.unit_amount,
    currency: price.currency ?? 'usd',
    customer: customerId,
    metadata: {
      ghoast_user_id: userId,
      pack_type: pack.packType,
      credits: String(pack.credits),
    },
  });

  if (!paymentIntent.client_secret) throw new Error('Stripe did not return a client secret');
  return {
    clientSecret: paymentIntent.client_secret,
    packType: pack.packType,
    credits: pack.credits,
  };
}

/**
 * Creates a Stripe Customer Portal session.
 * Returns the portal URL.
 */
export async function createPortalSession(userId: string, returnUrl: string): Promise<string> {
  const customerId = await getOrCreateStripeCustomer(userId);

  const session = await getStripeClient().billingPortal.sessions.create({
    customer: customerId,
    return_url: returnUrl,
  });

  return session.url;
}

// ── Webhook handler ───────────────────────────────────────────────────────────

/**
 * Verifies and processes a Stripe webhook event.
 * SECURITY: always called with the raw request body — never parsed JSON.
 * CRITICAL: idempotent — safe to call multiple times with the same event.
 */
export async function handleStripeWebhook(
  rawBody: Buffer,
  signature: string,
): Promise<void> {
  if (!process.env.STRIPE_WEBHOOK_SECRET) {
    throw new Error('STRIPE_WEBHOOK_SECRET not configured');
  }

  let event: Stripe.Event;
  try {
    event = getStripeClient().webhooks.constructEvent(rawBody, signature, process.env.STRIPE_WEBHOOK_SECRET);
  } catch {
    throw new InvalidWebhookSignatureError();
  }

  logger.info({ eventType: event.type, eventId: event.id }, 'Stripe webhook received');

  try {
    switch (event.type) {
      case 'invoice.payment_succeeded':
        await handleInvoicePaymentSucceeded(event.data.object as Stripe.Invoice);
        break;

      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;

      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
        break;

      case 'payment_intent.succeeded':
        await handlePaymentIntentSucceeded(event.data.object as Stripe.PaymentIntent);
        break;

      default:
        logger.info({ eventType: event.type }, 'Unhandled Stripe webhook event');
    }
  } catch (err) {
    // Log processing errors but ALWAYS return 200 to Stripe (retries are Stripe's responsibility)
    logger.error({ eventType: event.type, eventId: event.id, err }, 'Stripe webhook processing error');
  }
}

// ── Webhook event processors ──────────────────────────────────────────────────

async function handleInvoicePaymentSucceeded(invoice: Stripe.Invoice): Promise<void> {
  const subscriptionId = typeof invoice.subscription === 'string'
    ? invoice.subscription
    : invoice.subscription?.id;

  if (!subscriptionId) return;

  const subscription = await getStripeClient().subscriptions.retrieve(subscriptionId);
  const userId = subscription.metadata?.['ghoast_user_id'];
  if (!userId) {
    logger.warn({ subscriptionId }, 'Subscription has no ghoast_user_id metadata');
    return;
  }

  const priceId = subscription.items.data[0]?.price.id;
  const tier = priceIdToTier(priceId);

  await prisma.$transaction([
    prisma.user.update({ where: { id: userId }, data: { tier } }),
    prisma.subscription.upsert({
      where: { stripeSubscriptionId: subscriptionId },
      create: {
        userId,
        stripeSubscriptionId: subscriptionId,
        stripePriceId: priceId ?? '',
        tier,
        status: 'ACTIVE',
        currentPeriodStart: new Date(subscription.current_period_start * 1000),
        currentPeriodEnd: new Date(subscription.current_period_end * 1000),
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
      },
      update: {
        status: 'ACTIVE',
        tier,
        currentPeriodStart: new Date(subscription.current_period_start * 1000),
        currentPeriodEnd: new Date(subscription.current_period_end * 1000),
      },
    }),
  ]);

  logger.info({ userId, tier, subscriptionId }, 'Subscription activated');
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription): Promise<void> {
  const userId = subscription.metadata?.['ghoast_user_id'];
  if (!userId) return;

  await prisma.$transaction([
    prisma.user.update({ where: { id: userId }, data: { tier: 'FREE' } }),
    prisma.subscription.updateMany({
      where: { stripeSubscriptionId: subscription.id },
      data: { status: 'CANCELED' },
    }),
  ]);

  logger.info({ userId, subscriptionId: subscription.id }, 'Subscription cancelled — user downgraded to Free');
}

async function handleSubscriptionUpdated(subscription: Stripe.Subscription): Promise<void> {
  const userId = subscription.metadata?.['ghoast_user_id'];
  if (!userId) return;

  const priceId = subscription.items.data[0]?.price.id;
  const tier = priceIdToTier(priceId);

  await prisma.$transaction([
    prisma.user.update({ where: { id: userId }, data: { tier } }),
    prisma.subscription.updateMany({
      where: { stripeSubscriptionId: subscription.id },
      data: {
        tier,
        currentPeriodStart: new Date(subscription.current_period_start * 1000),
        currentPeriodEnd: new Date(subscription.current_period_end * 1000),
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
      },
    }),
  ]);

  logger.info({ userId, tier, subscriptionId: subscription.id }, 'Subscription updated');
}

async function handlePaymentIntentSucceeded(paymentIntent: Stripe.PaymentIntent): Promise<void> {
  const userId = paymentIntent.metadata?.['ghoast_user_id'];
  const packType = paymentIntent.metadata?.['pack_type'];
  const creditsStr = paymentIntent.metadata?.['credits'];

  if (!userId || !packType || !creditsStr) return;

  const credits = parseInt(creditsStr, 10);
  if (isNaN(credits) || credits <= 0) return;

  // IDEMPOTENCY: the unique constraint on stripe_payment_intent_id prevents double-crediting
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { creditBalance: true },
  });
  if (!user) return;

  try {
    await prisma.$transaction([
      prisma.creditTransaction.create({
        data: {
          userId,
          type: 'PURCHASE',
          creditsAdded: credits,
          balanceAfter: user.creditBalance + credits,
          packType,
          pricePaidCents: paymentIntent.amount,
          stripePaymentIntentId: paymentIntent.id,
        },
      }),
      prisma.user.update({
        where: { id: userId },
        data: { creditBalance: { increment: credits } },
      }),
    ]);
    logger.info({ userId, credits, packType, paymentIntentId: paymentIntent.id }, 'Credits added');
  } catch (err) {
    // Unique constraint violation = duplicate webhook — silently ignore
    if (err instanceof Error && err.message.includes('Unique constraint')) {
      logger.info({ paymentIntentId: paymentIntent.id }, 'Duplicate payment_intent webhook — ignored');
      return;
    }
    throw err;
  }
}

// ── Credit management ─────────────────────────────────────────────────────────

/**
 * Returns the current credit balance for the given user.
 */
export async function getBalance(userId: string): Promise<number> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { creditBalance: true },
  });
  if (!user) throw new UserNotFoundError();
  return user.creditBalance;
}

/**
 * Atomically consumes one credit from the user's balance.
 * Throws InsufficientCreditsError if balance is 0.
 * Uses a transaction to prevent race conditions under concurrent queue jobs.
 */
export async function consumeCredit(userId: string): Promise<number> {
  return prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({
      where: { id: userId },
      select: { creditBalance: true },
    });

    if (!user) throw new UserNotFoundError();
    if (user.creditBalance <= 0) throw new InsufficientCreditsError();

    const newBalance = user.creditBalance - 1;

    await tx.creditTransaction.create({
      data: {
        userId,
        type: 'CONSUME',
        creditsConsumed: 1,
        balanceAfter: newBalance,
      },
    });

    await tx.user.update({
      where: { id: userId },
      data: { creditBalance: newBalance },
    });

    return newBalance;
  });
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function priceIdToTier(priceId: string | undefined): UserTier {
  if (priceId === process.env.STRIPE_PRICE_PROPLUS_MONTHLY) return 'PRO_PLUS';
  if (priceId === process.env.STRIPE_PRICE_PRO_MONTHLY) return 'PRO';
  return 'FREE';
}
