jest.mock('../../src/lib/redis.js', () => ({
  redis: {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
  },
}));

import { redis } from '../../src/lib/redis.js';
import {
  areInstagramActionsConfigured,
  assertInstagramActionsEnabled,
  getTrialManualActionLimit,
  getTrialQueueSizeLimit,
  InstagramActionsDisabledError,
  isTrialAccountAllowed,
  setInstagramEmergencyStop,
  stopInstagramActionsForAccount,
} from '../../src/config/action-policy.js';

describe('Instagram action policy', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.INSTAGRAM_ACTIONS_ENABLED;
    delete process.env.TRIAL_ALLOWED_ACCOUNT_IDS;
    delete process.env.TRIAL_MAX_MANUAL_ACTIONS;
    delete process.env.TRIAL_MAX_QUEUE_SIZE;
    (redis.get as jest.Mock).mockResolvedValue(null);
  });

  it('denies actions by default', async () => {
    expect(areInstagramActionsConfigured()).toBe(false);
    await expect(assertInstagramActionsEnabled()).rejects.toBeInstanceOf(
      InstagramActionsDisabledError,
    );
    expect(redis.get).not.toHaveBeenCalled();
  });

  it('allows actions only when explicitly enabled and not emergency-stopped', async () => {
    process.env.INSTAGRAM_ACTIONS_ENABLED = 'true';
    process.env.TRIAL_ALLOWED_ACCOUNT_IDS = 'account-1';

    await expect(assertInstagramActionsEnabled('account-1')).resolves.toBeUndefined();
    expect(redis.get).toHaveBeenCalledWith('ghoast:instagram-actions:stopped');
  });

  it('blocks actions when the Redis emergency stop is active', async () => {
    process.env.INSTAGRAM_ACTIONS_ENABLED = 'true';
    process.env.TRIAL_ALLOWED_ACCOUNT_IDS = 'account-1';
    (redis.get as jest.Mock).mockResolvedValue('1');

    await expect(assertInstagramActionsEnabled('account-1')).rejects.toBeInstanceOf(
      InstagramActionsDisabledError,
    );
  });

  it('blocks accounts that are not explicitly allowlisted', async () => {
    process.env.INSTAGRAM_ACTIONS_ENABLED = 'true';
    process.env.TRIAL_ALLOWED_ACCOUNT_IDS = 'account-1, account-2';

    expect(isTrialAccountAllowed('account-2')).toBe(true);
    await expect(assertInstagramActionsEnabled('account-3')).rejects.toBeInstanceOf(
      InstagramActionsDisabledError,
    );
    expect(redis.get).not.toHaveBeenCalled();
  });

  it('uses conservative trial limits by default', () => {
    expect(getTrialManualActionLimit()).toBe(1);
    expect(getTrialQueueSizeLimit()).toBe(3);

    process.env.TRIAL_MAX_MANUAL_ACTIONS = '2';
    process.env.TRIAL_MAX_QUEUE_SIZE = '5';
    expect(getTrialManualActionLimit()).toBe(2);
    expect(getTrialQueueSizeLimit()).toBe(5);
  });

  it('sets and clears the emergency stop', async () => {
    await setInstagramEmergencyStop(true);
    expect(redis.set).toHaveBeenCalledWith('ghoast:instagram-actions:stopped', '1');

    await setInstagramEmergencyStop(false);
    expect(redis.del).toHaveBeenCalledWith('ghoast:instagram-actions:stopped');
  });

  it('can permanently stop actions for a deleted account', async () => {
    await stopInstagramActionsForAccount('account-1');
    expect(redis.set).toHaveBeenCalledWith(
      'ghoast:instagram-actions:account:account-1:stopped',
      '1',
    );
  });
});
