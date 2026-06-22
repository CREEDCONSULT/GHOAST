import {
  fetchInstagramUserInfo,
  InstagramApiError,
  InstagramChallengeError,
  InstagramTemporarilyBlockedError,
  unfollowUser,
} from '../../src/lib/instagram.js';

const fetchMock = jest.fn();

describe('Instagram adapter', () => {
  beforeAll(() => {
    global.fetch = fetchMock;
  });

  beforeEach(() => {
    fetchMock.mockReset();
  });

  it('uses GET for read requests', async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          status: 'ok',
          user: { pk: 'ig-1', username: 'trial_user' },
        }),
        { status: 200 },
      ),
    );

    await fetchInstagramUserInfo('session-token');

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/accounts/current_user/'),
      expect.objectContaining({ method: 'GET' }),
    );
  });

  it('uses POST with a form body for unfollow mutations', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ status: 'ok' }), { status: 200 }));

    await unfollowUser('owner-1', 'target-1', 'session-token');

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/friendships/destroy/target-1/'),
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('user_id=target-1'),
      }),
    );
  });

  it('classifies Instagram challenge responses', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ message: 'challenge_required' }), { status: 400 }),
    );

    await expect(fetchInstagramUserInfo('session-token')).rejects.toBeInstanceOf(
      InstagramChallengeError,
    );
  });

  it('classifies temporary action blocks', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ message: 'feedback_required, please wait' }), { status: 400 }),
    );

    await expect(unfollowUser('owner-1', 'target-1', 'session-token')).rejects.toBeInstanceOf(
      InstagramTemporarilyBlockedError,
    );
  });

  it('preserves unexpected upstream status without leaking the response body', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ sensitive: 'upstream body' }), { status: 400 }),
    );

    await expect(fetchInstagramUserInfo('session-token')).rejects.toEqual(
      expect.objectContaining<Partial<InstagramApiError>>({
        name: 'InstagramApiError',
        statusCode: 400,
        message: 'Instagram API returned 400',
      }),
    );
  });
});
