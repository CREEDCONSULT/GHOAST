/**
 * Phase 0 — Queue Configuration Unit Tests
 */
import { QUEUE_CONFIG, randomDelay, randomSessionPauseTrigger } from '../../src/config/queue.js';

describe('Queue configuration constants', () => {
  it('delay range is 8,000ms – 45,000ms', () => {
    expect(QUEUE_CONFIG.UNFOLLOW_DELAY_MIN_MS).toBe(8_000);
    expect(QUEUE_CONFIG.UNFOLLOW_DELAY_MAX_MS).toBe(45_000);
  });

  it('session pause trigger range is 10–15', () => {
    expect(QUEUE_CONFIG.SESSION_PAUSE_TRIGGER_MIN).toBe(10);
    expect(QUEUE_CONFIG.SESSION_PAUSE_TRIGGER_MAX).toBe(15);
  });

  it('session pause duration is 3–7 minutes', () => {
    expect(QUEUE_CONFIG.SESSION_PAUSE_MIN_MS).toBe(180_000);
    expect(QUEUE_CONFIG.SESSION_PAUSE_MAX_MS).toBe(420_000);
  });

  it('rate-limit pause is 15 minutes (900,000ms)', () => {
    expect(QUEUE_CONFIG.RATE_LIMIT_PAUSE_MS).toBe(900_000);
  });

  it('daily caps are 150 for Pro and Pro+', () => {
    expect(QUEUE_CONFIG.DAILY_CAP_PRO).toBe(150);
    expect(QUEUE_CONFIG.DAILY_CAP_PRO_PLUS).toBe(150);
  });

  it('free tier cap is 10 (manual only)', () => {
    expect(QUEUE_CONFIG.DAILY_CAP_FREE).toBe(10);
  });
});

describe('randomDelay', () => {
  it('returns a value within the specified range', () => {
    for (let i = 0; i < 100; i++) {
      const delay = randomDelay(8_000, 45_000);
      expect(delay).toBeGreaterThanOrEqual(8_000);
      expect(delay).toBeLessThanOrEqual(45_000);
    }
  });

  it('returns an integer', () => {
    const delay = randomDelay(8_000, 45_000);
    expect(Number.isInteger(delay)).toBe(true);
  });
});

describe('randomSessionPauseTrigger', () => {
  it('returns a value between 10 and 15', () => {
    for (let i = 0; i < 50; i++) {
      const trigger = randomSessionPauseTrigger();
      expect(trigger).toBeGreaterThanOrEqual(10);
      expect(trigger).toBeLessThanOrEqual(15);
    }
  });
});
