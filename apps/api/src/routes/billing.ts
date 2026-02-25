/**
 * Billing Routes
 *
 * POST /api/v1/billing/subscribe    — Create Stripe Checkout session for Pro/Pro+
 * POST /api/v1/billing/credits      — Create Stripe Payment Intent for credit pack
 * GET  /api/v1/billing/portal       — Create Stripe Customer Portal session
 * GET  /api/v1/billing/balance      — Return current credit balance
 *
 * POST /api/v1/webhooks/stripe      — Stripe webhook handler (raw body required)
 *
 * Note: /webhooks/stripe is registered at the root /api/v1 level by the caller
 * with addContentTypeParser for 'application/json' to preserve raw body.
 */

import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireAuth } from '../middleware/requireAuth.js';
import {
  createSubscribeCheckout,
  createCreditPaymentIntent,
  createPortalSession,
  handleStripeWebhook,
  getBalance,
  InvalidWebhookSignatureError,
} from '../services/billing.service.js';
import { logger } from '../lib/logger.js';

// ── Validation schemas ─────────────────────────────────────────────────────────

const subscribeBody = z.object({
  tier: z.enum(['PRO', 'PRO_PLUS']),
  successUrl: z.string().url(),
  cancelUrl: z.string().url(),
});

const creditsBody = z.object({
  priceId: z.string().min(1),
});

const portalBody = z.object({
  returnUrl: z.string().url(),
});

// ── Routes ────────────────────────────────────────────────────────────────────

export async function billingRoutes(app: FastifyInstance): Promise<void> {
  // ── POST /billing/subscribe ─────────────────────────────────────────────────

  app.post<{ Body: z.infer<typeof subscribeBody> }>(
    '/subscribe',
    { preHandler: requireAuth },
    async (request, reply) => {
      const parsed = subscribeBody.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: 'Bad Request', details: parsed.error.flatten() });
      }

      try {
        const url = await createSubscribeCheckout(
          request.user!.id,
          parsed.data.tier,
          parsed.data.successUrl,
          parsed.data.cancelUrl,
        );
        return reply.status(200).send({ url });
      } catch (err) {
        logger.error({ userId: request.user?.id, err }, 'Failed to create subscribe checkout');
        return reply.status(500).send({ error: 'Internal Server Error' });
      }
    },
  );

  // ── POST /billing/credits ───────────────────────────────────────────────────

  app.post<{ Body: z.infer<typeof creditsBody> }>(
    '/credits',
    { preHandler: requireAuth },
    async (request, reply) => {
      const parsed = creditsBody.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: 'Bad Request', details: parsed.error.flatten() });
      }

      try {
        const result = await createCreditPaymentIntent(request.user!.id, parsed.data.priceId);
        return reply.status(200).send(result);
      } catch (err) {
        if (err instanceof Error && err.message === 'Invalid credit pack price ID') {
          return reply.status(400).send({ error: 'Bad Request', message: err.message });
        }
        logger.error({ userId: request.user?.id, err }, 'Failed to create credit payment intent');
        return reply.status(500).send({ error: 'Internal Server Error' });
      }
    },
  );

  // ── GET /billing/portal ─────────────────────────────────────────────────────

  app.post<{ Body: z.infer<typeof portalBody> }>(
    '/portal',
    { preHandler: requireAuth },
    async (request, reply) => {
      const parsed = portalBody.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: 'Bad Request', details: parsed.error.flatten() });
      }

      try {
        const url = await createPortalSession(request.user!.id, parsed.data.returnUrl);
        return reply.status(200).send({ url });
      } catch (err) {
        logger.error({ userId: request.user?.id, err }, 'Failed to create portal session');
        return reply.status(500).send({ error: 'Internal Server Error' });
      }
    },
  );

  // ── GET /billing/balance ─────────────────────────────────────────────────────

  app.get(
    '/balance',
    { preHandler: requireAuth },
    async (request, reply) => {
      try {
        const balance = await getBalance(request.user!.id);
        return reply.status(200).send({ balance });
      } catch (err) {
        logger.error({ userId: request.user?.id, err }, 'Failed to get credit balance');
        return reply.status(500).send({ error: 'Internal Server Error' });
      }
    },
  );
}

// ── Stripe webhook route (registered separately — needs raw body) ──────────────

export async function stripeWebhookRoute(app: FastifyInstance): Promise<void> {
  // Parse application/json as raw Buffer for signature verification
  app.addContentTypeParser(
    'application/json',
    { parseAs: 'buffer' },
    (_req, body, done) => done(null, body),
  );

  app.post<{ Body: Buffer }>(
    '/webhooks/stripe',
    async (request, reply) => {
      const signature = request.headers['stripe-signature'];
      if (!signature || typeof signature !== 'string') {
        return reply.status(400).send({ error: 'Missing stripe-signature header' });
      }

      try {
        await handleStripeWebhook(request.body, signature);
        return reply.status(200).send({ received: true });
      } catch (err) {
        if (err instanceof InvalidWebhookSignatureError) {
          return reply.status(400).send({ error: 'Bad Request', message: err.message });
        }
        // Unexpected error — still return 200 (Stripe will retry otherwise)
        logger.error({ err }, 'Stripe webhook handler threw unexpected error');
        return reply.status(200).send({ received: true });
      }
    },
  );
}
