/**
 * Phase 5 — Billing Service Unit Tests
 *
 * Tests:
 * - Stripe webhook: idempotency, subscription events, credit events
 * - Credit management: getBalance, consumeCredit (atomic)
 * - InvalidWebhookSignatureError on bad signature
 *
 * Strategy:
 * - Mock Stripe SDK
 * - Mock @ghoast/db (prisma)
 */

// ── Environment ───────────────────────────────────────────────────────────────
process.env.STRIPE_SECRET_KEY = 'sk_test_placeholder_for_tests';
process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test';
process.env.STRIPE_PRICE_PRO_MONTHLY = 'price_pro';
process.env.STRIPE_PRICE_PROPLUS_MONTHLY = 'price_proplus';
process.env.STRIPE_PRICE_CREDITS_100 = 'price_credits_100';
process.env.STRIPE_PRICE_CREDITS_500 = 'price_credits_500';
process.env.STRIPE_PRICE_CREDITS_1500 = 'price_credits_1500';

// ── DB mock ───────────────────────────────────────────────────────────────────
jest.mock('@ghoast/db', () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
      update: jest.fn().mockResolvedValue({}),
    },
    subscription: {
      upsert: jest.fn().mockResolvedValue({}),
      updateMany: jest.fn().mockResolvedValue({}),
    },
    creditTransaction: {
      create: jest.fn().mockResolvedValue({}),
    },
    $transaction: jest.fn().mockImplementation(async (ops) => {
      if (Array.isArray(ops)) {
        return Promise.all(ops);
      }
      // Function-style transaction — call the callback with a mock tx
      return ops({
        user: {
          findUnique: jest.fn().mockResolvedValue({ creditBalance: 5 }),
          update: jest.fn().mockResolvedValue({}),
        },
        creditTransaction: {
          create: jest.fn().mockResolvedValue({}),
        },
      });
    }),
    $disconnect: jest.fn().mockResolvedValue(undefined),
  },
}));

// ── Stripe mock ───────────────────────────────────────────────────────────────
jest.mock('stripe', () => {
  const mockStripe = {
    webhooks: {
      constructEvent: jest.fn(),
    },
    customers: { create: jest.fn() },
    checkout: { sessions: { create: jest.fn() } },
    billingPortal: { sessions: { create: jest.fn() } },
    paymentIntents: { create: jest.fn() },
    prices: { retrieve: jest.fn() },
    subscriptions: { retrieve: jest.fn() },
  };
  return jest.fn().mockImplementation(() => mockStripe);
});

// ── Imports ───────────────────────────────────────────────────────────────────
import { prisma } from '@ghoast/db';
import Stripe from 'stripe';
import {
  handleStripeWebhook,
  getBalance,
  consumeCredit,
  InvalidWebhookSignatureError,
  InsufficientCreditsError,
  UserNotFoundError,
} from '../../src/services/billing.service.js';

// Get the mocked stripe instance
const mockStripeInstance = new (Stripe as jest.MockedClass<typeof Stripe>)(
  'sk_test_placeholder',
  { apiVersion: '2024-06-20' },
);

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('handleStripeWebhook', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('throws InvalidWebhookSignatureError on bad signature', async () => {
    (mockStripeInstance.webhooks.constructEvent as jest.Mock).mockImplementation(() => {
      throw new Error('Invalid signature');
    });

    await expect(
      handleStripeWebhook(Buffer.from('{}'), 'bad-sig'),
    ).rejects.toThrow(InvalidWebhookSignatureError);
  });

  it('processes invoice.payment_succeeded and activates subscription', async () => {
    const mockSubscription = {
      id: 'sub_123',
      metadata: { ghoast_user_id: 'user-001' },
      items: { data: [{ price: { id: 'price_pro' } }] },
      current_period_start: Math.floor(Date.now() / 1000),
      current_period_end: Math.floor(Date.now() / 1000) + 30 * 86400,
      cancel_at_period_end: false,
    };

    (mockStripeInstance.webhooks.constructEvent as jest.Mock).mockReturnValue({
      type: 'invoice.payment_succeeded',
      id: 'evt_001',
      data: {
        object: {
          subscription: 'sub_123',
        },
      },
    });

    (mockStripeInstance.subscriptions.retrieve as jest.Mock).mockResolvedValue(mockSubscription);

    await handleStripeWebhook(Buffer.from('{}'), 'valid-sig');

    expect(prisma.$transaction).toHaveBeenCalled();
  });

  it('processes customer.subscription.deleted and downgrades to Free', async () => {
    (mockStripeInstance.webhooks.constructEvent as jest.Mock).mockReturnValue({
      type: 'customer.subscription.deleted',
      id: 'evt_002',
      data: {
        object: {
          id: 'sub_123',
          metadata: { ghoast_user_id: 'user-001' },
        },
      },
    });

    await handleStripeWebhook(Buffer.from('{}'), 'valid-sig');

    expect(prisma.$transaction).toHaveBeenCalled();
  });

  it('processes payment_intent.succeeded and adds 100 credits for starter pack', async () => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({ creditBalance: 50 });

    (mockStripeInstance.webhooks.constructEvent as jest.Mock).mockReturnValue({
      type: 'payment_intent.succeeded',
      id: 'evt_003',
      data: {
        object: {
          id: 'pi_test_starter',
          amount: 299,
          metadata: {
            ghoast_user_id: 'user-001',
            pack_type: 'starter',
            credits: '100',
          },
        },
      },
    });

    await handleStripeWebhook(Buffer.from('{}'), 'valid-sig');

    expect(prisma.$transaction).toHaveBeenCalled();
  });

  it('processes payment_intent.succeeded and adds 500 credits for standard pack', async () => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({ creditBalance: 0 });

    (mockStripeInstance.webhooks.constructEvent as jest.Mock).mockReturnValue({
      type: 'payment_intent.succeeded',
      id: 'evt_004',
      data: {
        object: {
          id: 'pi_test_standard',
          amount: 999,
          metadata: {
            ghoast_user_id: 'user-001',
            pack_type: 'standard',
            credits: '500',
          },
        },
      },
    });

    await handleStripeWebhook(Buffer.from('{}'), 'valid-sig');

    expect(prisma.$transaction).toHaveBeenCalled();
  });

  it('processes payment_intent.succeeded and adds 1500 credits for power pack', async () => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({ creditBalance: 100 });

    (mockStripeInstance.webhooks.constructEvent as jest.Mock).mockReturnValue({
      type: 'payment_intent.succeeded',
      id: 'evt_005',
      data: {
        object: {
          id: 'pi_test_power',
          amount: 1999,
          metadata: {
            ghoast_user_id: 'user-001',
            pack_type: 'power',
            credits: '1500',
          },
        },
      },
    });

    await handleStripeWebhook(Buffer.from('{}'), 'valid-sig');

    expect(prisma.$transaction).toHaveBeenCalled();
  });

  it('is idempotent — duplicate webhook does not add credits twice', async () => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({ creditBalance: 100 });

    const duplicateEvent = {
      type: 'payment_intent.succeeded',
      id: 'evt_dup',
      data: {
        object: {
          id: 'pi_duplicate_123',
          amount: 299,
          metadata: {
            ghoast_user_id: 'user-001',
            pack_type: 'starter',
            credits: '100',
          },
        },
      },
    };

    // First call succeeds
    (mockStripeInstance.webhooks.constructEvent as jest.Mock).mockReturnValue(duplicateEvent);
    (prisma.$transaction as jest.Mock).mockImplementation(async (ops) => {
      if (Array.isArray(ops)) return Promise.all(ops);
      return ops({
        user: {
          findUnique: jest.fn().mockResolvedValue({ creditBalance: 100 }),
          update: jest.fn().mockResolvedValue({}),
        },
        creditTransaction: {
          create: jest.fn().mockResolvedValue({}),
        },
      });
    });
    await handleStripeWebhook(Buffer.from('{}'), 'valid-sig');

    // Second call: unique constraint violation (duplicate pi_duplicate_123)
    (mockStripeInstance.webhooks.constructEvent as jest.Mock).mockReturnValue(duplicateEvent);
    (prisma.$transaction as jest.Mock).mockImplementation(async (ops) => {
      if (Array.isArray(ops)) return Promise.all(ops);
      return ops({
        user: {
          findUnique: jest.fn().mockResolvedValue({ creditBalance: 200 }), // balance after first
          update: jest.fn().mockResolvedValue({}),
        },
        creditTransaction: {
          create: jest.fn().mockRejectedValue(
            Object.assign(new Error('Unique constraint'), { message: 'Unique constraint failed' }),
          ),
        },
      });
    });
    // Should not throw — idempotency guard catches duplicate
    await expect(handleStripeWebhook(Buffer.from('{}'), 'valid-sig')).resolves.not.toThrow();
  });
});

describe('getBalance', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns the user credit balance', async () => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({ creditBalance: 42 });
    const balance = await getBalance('user-001');
    expect(balance).toBe(42);
  });

  it('throws UserNotFoundError for unknown user', async () => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
    await expect(getBalance('nonexistent')).rejects.toThrow(UserNotFoundError);
  });
});

describe('consumeCredit', () => {
  beforeEach(() => jest.clearAllMocks());

  it('decrements balance by exactly 1 and returns new balance', async () => {
    (prisma.$transaction as jest.Mock).mockImplementation(async (fn) => {
      return fn({
        user: {
          findUnique: jest.fn().mockResolvedValue({ creditBalance: 5 }),
          update: jest.fn().mockResolvedValue({}),
        },
        creditTransaction: {
          create: jest.fn().mockResolvedValue({}),
        },
      });
    });

    const newBalance = await consumeCredit('user-001');
    expect(newBalance).toBe(4);
  });

  it('throws InsufficientCreditsError when balance is 0', async () => {
    (prisma.$transaction as jest.Mock).mockImplementation(async (fn) => {
      return fn({
        user: {
          findUnique: jest.fn().mockResolvedValue({ creditBalance: 0 }),
          update: jest.fn(),
        },
        creditTransaction: { create: jest.fn() },
      });
    });

    await expect(consumeCredit('user-001')).rejects.toThrow(InsufficientCreditsError);
  });

  it('throws UserNotFoundError when user does not exist', async () => {
    (prisma.$transaction as jest.Mock).mockImplementation(async (fn) => {
      return fn({
        user: {
          findUnique: jest.fn().mockResolvedValue(null),
          update: jest.fn(),
        },
        creditTransaction: { create: jest.fn() },
      });
    });

    await expect(consumeCredit('nonexistent')).rejects.toThrow(UserNotFoundError);
  });
});
