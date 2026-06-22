import { prisma } from '@ghoast/db';
import { cancelUserSubscriptions } from './billing.service.js';
import { getUnfollowQueue } from './queue.service.js';
import { stopInstagramActionsForAccount } from '../config/action-policy.js';
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
  await Promise.all(accountIds.map((accountId) => stopInstagramActionsForAccount(accountId)));
  await removeQueuedAccountJobs(accountIds);
  await cancelUserSubscriptions(userId);
  await prisma.user.delete({ where: { id: userId } });

  logger.info({ userId, deletedInstagramAccounts: accountIds.length }, 'User account deleted');
}

async function removeQueuedAccountJobs(accountIds: string[]): Promise<void> {
  if (accountIds.length === 0) return;

  const accountIdSet = new Set(accountIds);
  const queue = getUnfollowQueue();
  const jobs = await queue.getJobs(['waiting', 'delayed', 'paused']);
  const matchingJobs = jobs.filter((job) => accountIdSet.has(job.data.accountId));
  await Promise.all(matchingJobs.map((job) => job.remove()));
}
