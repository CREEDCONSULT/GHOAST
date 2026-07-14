import { prisma } from '@ghoast/db';
import { cancelUserSubscriptions } from './billing.service.js';
import { logger } from '../lib/logger.js';

export class UserDeletionNotFoundError extends Error {
  constructor() {
    super('User not found.');
    this.name = 'UserDeletionNotFoundError';
  }
}

export async function deleteUserAccount(userId: string): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      instagramAccounts: { select: { id: true } },
    },
  });

  if (!user) throw new UserDeletionNotFoundError();

  const accountIds = user.instagramAccounts.map(({ id }) => id);

  // Cancel any active Stripe subscriptions, then delete the user. The delete cascades
  // to Instagram accounts, ghosts, snapshots, and queue rows via schema onDelete rules.
  await cancelUserSubscriptions(userId);
  await prisma.user.delete({ where: { id: userId } });

  logger.info({ userId, deletedInstagramAccounts: accountIds.length }, 'User account deleted');
}
