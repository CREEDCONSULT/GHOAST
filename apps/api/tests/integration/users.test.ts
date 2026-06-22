process.env.JWT_SECRET = 'test-jwt-secret-at-least-32-chars-long!!';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-at-least-32-chars-long!!';
process.env.SESSION_TOKEN_ENCRYPTION_KEY = '0'.repeat(64);

jest.mock('../../src/lib/redis.js', () => ({
  redis: {
    status: 'ready',
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue('OK'),
    setex: jest.fn().mockResolvedValue('OK'),
    incr: jest.fn().mockResolvedValue(1),
    pexpire: jest.fn().mockResolvedValue(1),
    pttl: jest.fn().mockResolvedValue(60_000),
    del: jest.fn().mockResolvedValue(1),
    quit: jest.fn().mockResolvedValue('OK'),
    defineCommand: jest.fn(),
    rateLimit: jest.fn(),
    pipeline: jest.fn(),
    multi: jest.fn(),
    sendCommand: jest.fn(),
  },
}));

jest.mock('../../src/services/users.service.js', () => ({
  deleteUserAccount: jest.fn(),
  UserDeletionNotFoundError: class UserDeletionNotFoundError extends Error {},
}));

jest.mock('../../src/services/auth.service.js', () => ({
  register: jest.fn(),
  login: jest.fn(),
  refresh: jest.fn(),
  issueTokens: jest.fn(),
  verifyAccessToken: jest.fn().mockReturnValue({ sub: 'test-user-id' }),
  verifyRefreshToken: jest.fn(),
  EmailAlreadyExistsError: class EmailAlreadyExistsError extends Error {},
  InvalidCredentialsError: class InvalidCredentialsError extends Error {},
}));

jest.mock('@ghoast/db', () => ({
  prisma: {
    user: { findUnique: jest.fn() },
    $disconnect: jest.fn().mockResolvedValue(undefined),
  },
}));

import { prisma } from '@ghoast/db';
import { buildServer } from '../../src/server.js';
import { deleteUserAccount } from '../../src/services/users.service.js';

describe('User routes', () => {
  let app: Awaited<ReturnType<typeof buildServer>>;

  beforeAll(async () => {
    app = await buildServer();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({
      id: 'test-user-id',
      email: 'test@example.com',
      tier: 'FREE',
      creditBalance: 0,
    });
  });

  it('requires authentication', async () => {
    const response = await app.inject({
      method: 'DELETE',
      url: '/api/v1/users/me',
      payload: { confirmation: 'DELETE' },
    });
    expect(response.statusCode).toBe(401);
  });

  it('requires the exact destructive confirmation', async () => {
    const response = await app.inject({
      method: 'DELETE',
      url: '/api/v1/users/me',
      headers: { authorization: 'Bearer valid-test-token' },
      payload: { confirmation: 'delete' },
    });
    expect(response.statusCode).toBe(400);
    expect(deleteUserAccount).not.toHaveBeenCalled();
  });

  it('deletes the authenticated user and clears the refresh cookie', async () => {
    (deleteUserAccount as jest.Mock).mockResolvedValue(undefined);
    const response = await app.inject({
      method: 'DELETE',
      url: '/api/v1/users/me',
      headers: { authorization: 'Bearer valid-test-token' },
      payload: { confirmation: 'DELETE' },
    });

    expect(response.statusCode).toBe(204);
    expect(deleteUserAccount).toHaveBeenCalledWith('test-user-id');
    expect(response.headers['set-cookie']).toContain('ghoast_refresh=');
    expect(response.headers['set-cookie']).toContain('Path=/');
  });
});
