import { redis } from '../lib/redis.js';

const EMERGENCY_STOP_KEY = 'ghoast:instagram-actions:stopped';
const accountStopKey = (accountId: string) => `ghoast:instagram-actions:account:${accountId}:stopped`;

export class InstagramActionsDisabledError extends Error {
  readonly code = 'INSTAGRAM_ACTIONS_DISABLED';

  constructor() {
    super('Instagram actions are temporarily disabled.');
    this.name = 'InstagramActionsDisabledError';
  }
}

export function areInstagramActionsConfigured(): boolean {
  return process.env.INSTAGRAM_ACTIONS_ENABLED === 'true';
}

export function getTrialManualActionLimit(): number {
  return parsePositiveInteger(process.env.TRIAL_MAX_MANUAL_ACTIONS, 1);
}

export function getTrialQueueSizeLimit(): number {
  return parsePositiveInteger(process.env.TRIAL_MAX_QUEUE_SIZE, 3);
}

export function isTrialAccountAllowed(accountId: string): boolean {
  const allowedIds = (process.env.TRIAL_ALLOWED_ACCOUNT_IDS ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  return allowedIds.includes(accountId);
}

export async function assertInstagramActionsEnabled(accountId?: string): Promise<void> {
  if (!areInstagramActionsConfigured()) {
    throw new InstagramActionsDisabledError();
  }

  if (accountId !== undefined && !isTrialAccountAllowed(accountId)) {
    throw new InstagramActionsDisabledError();
  }

  const emergencyStop = await redis.get(EMERGENCY_STOP_KEY);
  if (emergencyStop === '1') {
    throw new InstagramActionsDisabledError();
  }

  if (accountId !== undefined && (await redis.get(accountStopKey(accountId))) === '1') {
    throw new InstagramActionsDisabledError();
  }
}

export async function setInstagramEmergencyStop(stopped: boolean): Promise<void> {
  if (stopped) {
    await redis.set(EMERGENCY_STOP_KEY, '1');
    return;
  }

  await redis.del(EMERGENCY_STOP_KEY);
}

export async function isInstagramEmergencyStopped(): Promise<boolean> {
  return (await redis.get(EMERGENCY_STOP_KEY)) === '1';
}

export async function stopInstagramActionsForAccount(accountId: string): Promise<void> {
  await redis.set(accountStopKey(accountId), '1');
}

function parsePositiveInteger(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}
