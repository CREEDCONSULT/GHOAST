import { nextDelayMs, validateExternalCommand, PACING_LIMITS } from '../protocol';

describe('validateExternalCommand — the security boundary', () => {
  const okCmd = {
    type: 'GHOAST_BATCH_START',
    usernames: ['a.b', 'c_d'],
    pacing: { intervalSeconds: 45, breakEvery: 25 },
  };

  it('accepts an allowed origin with a valid start command', () => {
    expect(validateExternalCommand(okCmd, 'https://ghoast.up.railway.app/cleanup')).toBeNull();
    expect(validateExternalCommand(okCmd, 'http://localhost:3000/cleanup')).toBeNull();
  });

  it('rejects unknown origins', () => {
    expect(validateExternalCommand(okCmd, 'https://evil.example.com')).toBe('unauthorized_origin');
    expect(validateExternalCommand(okCmd, undefined)).toBe('unauthorized_origin');
    expect(validateExternalCommand(okCmd, '')).toBe('unauthorized_origin');
  });

  it('rejects malformed commands', () => {
    expect(validateExternalCommand(null, 'https://ghoast.up.railway.app')).toBe('malformed');
    expect(validateExternalCommand({ type: 'NOPE' }, 'https://ghoast.up.railway.app')).toBe('malformed');
  });

  it('rejects duplicate usernames in a batch', () => {
    expect(
      validateExternalCommand(
        { ...okCmd, usernames: ['a.b', 'A.B'] },
        'https://ghoast.up.railway.app',
      ),
    ).toBe('duplicate_usernames');
  });

  it('rejects non-Instagram username shapes', () => {
    expect(
      validateExternalCommand({ ...okCmd, usernames: ['bad name!'] }, 'https://ghoast.up.railway.app'),
    ).toBe('invalid_username');
    expect(
      validateExternalCommand({ ...okCmd, usernames: ['x'.repeat(31)] }, 'https://ghoast.up.railway.app'),
    ).toBe('invalid_username');
  });

  it('refuses pacing below the floor', () => {
    expect(
      validateExternalCommand(
        { ...okCmd, pacing: { intervalSeconds: 5, breakEvery: 25 } },
        'https://ghoast.up.railway.app',
      ),
    ).toBe('pacing_out_of_bounds');
    expect(PACING_LIMITS.minIntervalSeconds).toBeGreaterThanOrEqual(20);
  });

  it('accepts lifecycle commands from allowed origins', () => {
    for (const type of ['GHOAST_BATCH_PAUSE', 'GHOAST_BATCH_RESUME', 'GHOAST_BATCH_STOP', 'GHOAST_BATCH_STATUS']) {
      expect(validateExternalCommand({ type }, 'https://ghoast.up.railway.app')).toBeNull();
    }
  });
});

describe('nextDelayMs', () => {
  it('never goes below the floor and adds jitter', () => {
    for (let i = 0; i < 100; i++) {
      const ms = nextDelayMs(5, () => 0.5); // floor applies regardless of input
      expect(ms).toBeGreaterThanOrEqual(20_000);
    }
    const deterministic = nextDelayMs(30, () => 0);
    expect(deterministic).toBe(30_000);
    const jittered = nextDelayMs(30, () => 0.999);
    expect(jittered).toBeLessThan(30_000 + 30_000 * 0.4 + 1);
  });
});
