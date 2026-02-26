/**
 * Ghoast Queue Configuration
 * All timing constants live here — never hardcode these in worker files.
 * Values sourced from CLAUDE.md queue rules and REQUIREMENTS.md F006.
 */

export const QUEUE_CONFIG = {
  // Delay between individual unfollow actions (milliseconds)
  UNFOLLOW_DELAY_MIN_MS: 8_000,
  UNFOLLOW_DELAY_MAX_MS: 45_000,

  // Session pause: trigger every N unfollows (random within range)
  SESSION_PAUSE_TRIGGER_MIN: 10,
  SESSION_PAUSE_TRIGGER_MAX: 15,

  // Session pause duration (milliseconds)
  SESSION_PAUSE_MIN_MS: 180_000, // 3 minutes
  SESSION_PAUSE_MAX_MS: 420_000, // 7 minutes

  // Rate-limit response pause (milliseconds)
  RATE_LIMIT_PAUSE_MS: 900_000, // 15 minutes

  // After this many rate-limit hits in one day, pause worker for 24h
  RATE_LIMIT_DAILY_THRESHOLD: 3,
  RATE_LIMIT_24H_PAUSE_MS: 86_400_000, // 24 hours

  // Daily unfollow caps
  DAILY_CAP_PRO: 150,
  DAILY_CAP_PRO_PLUS: 150,
  DAILY_CAP_FREE: 10, // manual only — no queue for free tier

  // Pro+ gets a shorter base delay (priority queue)
  UNFOLLOW_DELAY_PRO_PLUS_MIN_MS: 8_000,
  UNFOLLOW_DELAY_PRO_PLUS_MAX_MS: 25_000,

  // BullMQ queue names
  QUEUE_NAME_UNFOLLOW: 'unfollow',
  QUEUE_NAME_SCAN: 'scan',
  QUEUE_NAME_SNAPSHOT: 'snapshot',
  QUEUE_NAME_DISCONNECT: 'disconnect',
} as const;

/**
 * Returns a random delay between min and max (inclusive), in milliseconds.
 */
export function randomDelay(minMs: number, maxMs: number): number {
  return Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
}

/**
 * Returns a random session pause trigger count (10–15).
 */
export function randomSessionPauseTrigger(): number {
  return (
    Math.floor(
      Math.random() *
        (QUEUE_CONFIG.SESSION_PAUSE_TRIGGER_MAX - QUEUE_CONFIG.SESSION_PAUSE_TRIGGER_MIN + 1)
    ) + QUEUE_CONFIG.SESSION_PAUSE_TRIGGER_MIN
  );
}
