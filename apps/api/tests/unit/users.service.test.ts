jest.mock('@ghoast/db', () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
      delete: jest.fn(),
    },
  },
}));

jest.mock('../../src/services/billing.service.js', () => ({
  cancelUserSubscriptions: jest.fn(),
}));

const remove = jest.fn();
const getJobs = jest.fn();
jest.mock('../../src/services/queue.service.js', () => ({
  getUnfollowQueue: jest.fn(() => ({ getJobs })),
}));

jest.mock('../../src/config/action-policy.js', () => ({
  stopInstagramActionsForAccount: jest.fn(),
}));

import { prisma } from '@ghoast/db';
import { cancelUserSubscriptions } from '../../src/services/billing.service.js';
import { stopInstagramActionsForAccount } from '../../src/config/action-policy.js';
import {
  deleteUserAccount,
  UserDeletionNotFoundError,
} from '../../src/services/users.service.js';

describe('deleteUserAccount', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getJobs.mockResolvedValue([]);
  });

  it('blocks actions, removes queued work, cancels billing, then deletes the user', async () => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({
      id: 'user-1',
      instagramAccounts: [{ id: 'account-1' }],
    });
    getJobs.mockResolvedValue([
      { data: { accountId: 'account-1' }, remove },
      { data: { accountId: 'other-account' }, remove: jest.fn() },
    ]);

    await deleteUserAccount('user-1');

    expect(stopInstagramActionsForAccount).toHaveBeenCalledWith('account-1');
    expect(getJobs).toHaveBeenCalledWith(['waiting', 'delayed', 'paused']);
    expect(remove).toHaveBeenCalled();
    expect(cancelUserSubscriptions).toHaveBeenCalledWith('user-1');
    expect(prisma.user.delete).toHaveBeenCalledWith({ where: { id: 'user-1' } });
  });

  it('fails without changing anything when the user does not exist', async () => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);

    await expect(deleteUserAccount('missing')).rejects.toBeInstanceOf(
      UserDeletionNotFoundError,
    );
    expect(cancelUserSubscriptions).not.toHaveBeenCalled();
    expect(prisma.user.delete).not.toHaveBeenCalled();
  });
});
