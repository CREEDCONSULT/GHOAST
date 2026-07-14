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

import { prisma } from '@ghoast/db';
import { cancelUserSubscriptions } from '../../src/services/billing.service.js';
import {
  deleteUserAccount,
  UserDeletionNotFoundError,
} from '../../src/services/users.service.js';

describe('deleteUserAccount', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('cancels billing then deletes the user (cascade removes accounts + ghosts)', async () => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({
      id: 'user-1',
      instagramAccounts: [{ id: 'account-1' }],
    });

    await deleteUserAccount('user-1');

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
