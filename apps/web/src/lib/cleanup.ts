'use client';

/**
 * Cleanup batch library — durable local batches + lifecycle + receipts.
 *
 * Hard rules (written once, enforced here):
 *  - Protected (kept) accounts can never enter a batch.
 *  - Duplicates inside a batch are impossible (set-based construction).
 *  - An account can belong to at most one active (non-terminal) batch.
 *  - Nothing in here ever writes 'handled_verified' — verification is an
 *    export-derived outcome produced only by store.ingestParsedExport().
 */

import { db } from './db';
import type {
  CleanupBatch,
  CleanupReceipt,
  CleanupReceiptKind,
} from './types';
import { DEFAULT_CLEANUP_PACING } from './types';

/**
 * First-N selection over an ALREADY filtered+sorted list — the caller passes
 * its post-filter order, so active filters/sorts define "first" (spec: first-N
 * must respect active filtering and sorting).
 */
export function selectFirstN<T>(orderedItems: T[], n: number): T[] {
  return orderedItems.slice(0, Math.max(0, n));
}

/** True when a username may enter a batch (not protected, not already active elsewhere). */
export async function eligibleForBatch(
  username: string,
  protectedUsernames: Set<string>,
  activeBatches: CleanupBatch[],
): Promise<boolean> {
  return !protectedUsernames.has(username) && !activeBatches.some((b) => b.usernames.includes(username));
}

export interface CreateBatchInput {
  usernames: string[]; // already ordered as the user intends to process them
  sourceSnapshotId: string;
  userHrefsByUsername?: Map<string, string | null>;
}

/** Creates a new DRAFT batch. Throws on ineligible input — never partially creates. */
export async function createBatch(input: CreateBatchInput): Promise<CleanupBatch> {
  const unique = [...new Set(input.usernames.map((u) => u.toLowerCase()))];
  if (unique.length === 0) throw new Error('batch_empty');

  const decisions = await db.decisions.toArray();
  const protectedSet = new Set(
    decisions.filter((d) => d.state === 'kept').map((d) => d.username),
  );
  const active = await getActiveBatches();

  const eligible: string[] = [];
  const rejected: string[] = [];
  for (const u of unique) {
    if (protectedSet.has(u) || active.some((b) => b.usernames.includes(u))) rejected.push(u);
    else eligible.push(u);
  }
  if (eligible.length === 0) throw new Error('batch_all_ineligible');

  const batch: CleanupBatch = {
    id: crypto.randomUUID(),
    sourceSnapshotId: input.sourceSnapshotId,
    createdAt: Date.now(),
    status: 'draft',
    usernames: eligible,
    currentIndex: 0,
    completed: 0,
    skipped: 0,
    failed: 0,
    pacing: { ...DEFAULT_CLEANUP_PACING },
    receipts: [],
    driver: 'manual',
  };
  await db.cleanupBatches.put(batch);
  return batch;
}

export async function getBatch(id: string): Promise<CleanupBatch | undefined> {
  return db.cleanupBatches.get(id);
}

export async function getActiveBatches(): Promise<CleanupBatch[]> {
  return db.cleanupBatches
    .where('status')
    .anyOf(['draft', 'running', 'paused'])
    .toArray();
}

export async function getLatestBatch(): Promise<CleanupBatch | null> {
  const all = await db.cleanupBatches.orderBy('createdAt').reverse().toArray();
  return all[0] ?? null;
}

export async function setBatchStatus(id: string, status: CleanupBatch['status']): Promise<void> {
  await db.cleanupBatches.update(id, { status });
}

export async function setBatchDriver(id: string, driver: 'manual' | 'extension'): Promise<void> {
  await db.cleanupBatches.update(id, { driver });
}

export async function updateBatchPacing(id: string, pacing: CleanupBatch['pacing']): Promise<void> {
  await db.cleanupBatches.update(id, { pacing });
}

/**
 * Append a receipt and advance counters/cursor. Cursor movement is explicit:
 * 'confirmed'/'skipped'/'failed' advance past the current item; the remaining
 * kinds observe without moving.
 */
export async function recordReceipt(
  batchId: string,
  username: string,
  kind: CleanupReceiptKind,
  detail?: string,
): Promise<CleanupBatch | undefined> {
  const batch = await db.cleanupBatches.get(batchId);
  if (!batch) return undefined;

  const receipt: CleanupReceipt = { ts: Date.now(), username, kind, detail };
  const patch: Partial<CleanupBatch> = { receipts: [...batch.receipts, receipt] };

  if (kind === 'confirmed') {
    patch.completed = batch.completed + 1;
    patch.currentIndex = batch.currentIndex + 1;
  } else if (kind === 'skipped') {
    patch.skipped = batch.skipped + 1;
    patch.currentIndex = batch.currentIndex + 1;
  } else if (kind === 'failed') {
    patch.failed = batch.failed + 1;
    patch.currentIndex = batch.currentIndex + 1;
  } else if (kind === 'stopped') {
    patch.status = 'stopped';
  }

  if (patch.currentIndex != null && patch.currentIndex >= batch.usernames.length) {
    patch.status = 'done';
  }

  await db.cleanupBatches.update(batchId, patch);
  return getBatch(batchId);
}

/** Current work item; null when the batch is exhausted. */
export function currentItem(batch: CleanupBatch): string | null {
  return batch.currentIndex < batch.usernames.length
    ? batch.usernames[batch.currentIndex]
    : null;
}

/** Remaining work items (not yet completed/skipped/failed). */
export function remainingCount(batch: CleanupBatch): number {
  return Math.max(0, batch.usernames.length - batch.currentIndex);
}

/** Rough time estimate for the assistant-paced path, in minutes. */
export function estimatedMinutesRemaining(batch: CleanupBatch): number {
  return Math.ceil((remainingCount(batch) * batch.pacing.intervalSeconds) / 60);
}
