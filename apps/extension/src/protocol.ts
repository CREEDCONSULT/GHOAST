/**
 * Message protocol + boundary validation between the GHOAST web app and the
 * extension background worker. Pure functions → unit-tested.
 */

export const ALLOWED_WEB_ORIGINS: readonly string[] = [
  'https://ghoast.up.railway.app',
  'http://localhost:3000',
  'http://localhost:3100',
  'http://localhost:3110',
];

export type SessionCommand =
  | { type: 'GHOAST_BATCH_START'; usernames: string[]; pacing: Pacing }
  | { type: 'GHOAST_BATCH_PAUSE' }
  | { type: 'GHOAST_BATCH_RESUME' }
  | { type: 'GHOAST_BATCH_STOP' }
  | { type: 'GHOAST_BATCH_STATUS' };

export interface Pacing {
  intervalSeconds: number;
  breakEvery: number;
}

export const PACING_LIMITS = {
  minIntervalSeconds: 20, // floor — below this we refuse rather than race
  maxIntervalSeconds: 600,
  maxBatchSize: 500,
  maxUsernameLength: 30, // Instagram's own limit
} as const;

/** Returns an error string, or null when the command+sender are legitimate. */
export function validateExternalCommand(
  cmd: unknown,
  senderOrigin: string | undefined,
): string | null {
  if (!senderOrigin || !ALLOWED_WEB_ORIGINS.some((o) => senderOrigin.startsWith(o))) {
    return 'unauthorized_origin';
  }
  if (typeof cmd !== 'object' || cmd === null) return 'malformed';
  const c = cmd as Partial<SessionCommand>;
  switch (c.type) {
    case 'GHOAST_BATCH_START': {
      const usernames = (c as { usernames?: unknown }).usernames;
      const pacing = (c as { pacing?: unknown }).pacing as Pacing | undefined;
      if (!Array.isArray(usernames) || usernames.length === 0) return 'empty_batch';
      if (usernames.length > PACING_LIMITS.maxBatchSize) return 'batch_too_large';
      if (
        usernames.some(
          (u) => typeof u !== 'string' || !/^[a-zA-Z0-9._]{1,30}$/.test(u),
        )
      ) {
        return 'invalid_username';
      }
      if (new Set(usernames.map((u) => (u as string).toLowerCase())).size !== usernames.length) {
        return 'duplicate_usernames';
      }
      if (
        !pacing ||
        pacing.intervalSeconds < PACING_LIMITS.minIntervalSeconds ||
        pacing.intervalSeconds > PACING_LIMITS.maxIntervalSeconds
      ) {
        return 'pacing_out_of_bounds';
      }
      return null;
    }
    case 'GHOAST_BATCH_PAUSE':
    case 'GHOAST_BATCH_RESUME':
    case 'GHOAST_BATCH_STOP':
    case 'GHOAST_BATCH_STATUS':
      return null;
    default:
      return 'malformed';
  }
}

/** Conservative delay: paced, with jitter (humans don't act on a metronome). */
export function nextDelayMs(intervalSeconds: number, random: () => number = Math.random): number {
  const base = Math.max(intervalSeconds, PACING_LIMITS.minIntervalSeconds) * 1000;
  return base + Math.floor(random() * base * 0.4);
}
