/**
 * Store operations — the write side of GHOAST. All local, all reversible
 * where the spec demands reversibility (spec §4 principle 3).
 */

import { diffSnapshots } from './comparison';
import { db } from './db';
import { analyzeExport } from './analysis';
import type {
  Comparison,
  Decision,
  DecisionState,
  LedgerAction,
  ParsedExport,
  SettingsRecord,
  Snapshot,
} from './types';
import { DEFAULT_SETTINGS } from './types';

// ── Settings ─────────────────────────────────────────────────────────────────

export async function getSettings(): Promise<SettingsRecord> {
  const existing = await db.settings.get('app');
  if (existing) return { ...DEFAULT_SETTINGS, ...existing }; // forward-merge new settings keys
  await db.settings.put({ ...DEFAULT_SETTINGS });
  return { ...DEFAULT_SETTINGS };
}

export async function updateSettings(patch: Partial<SettingsRecord>): Promise<SettingsRecord> {
  const current = await getSettings();
  const next = { ...current, ...patch, id: 'app' as const };
  await db.settings.put(next);
  return next;
}

// ── Hashing (duplicate detection, spec §22) ──────────────────────────────────

export async function sha256Hex(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  const digest = await crypto.subtle.digest('SHA-256', buf);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

// ── Decisions ────────────────────────────────────────────────────────────────

async function recordEvent(
  username: string,
  action: LedgerAction,
  prevState: DecisionState | null,
  newState: DecisionState | null,
  snapshotId: string,
): Promise<void> {
  await db.events.add({
    ts: Date.now(),
    username,
    action,
    prevState,
    newState,
    snapshotId,
  });
}

export async function getDecision(username: string): Promise<Decision | undefined> {
  return db.decisions.get(username.toLowerCase());
}

export async function getAllDecisions(): Promise<Decision[]> {
  return db.decisions.toArray();
}

const ACTION_FOR_STATE: Record<DecisionState, LedgerAction> = {
  kept: 'kept',
  queued: 'queued',
  saved: 'saved',
  handled_self: 'handled_self',
  handled_verified: 'handled_verified',
};

/** Set (or clear) a decision. Clearing returns the account to Unreviewed. */
export async function setDecision(
  username: string,
  href: string | null,
  state: DecisionState | null,
  snapshotId: string,
): Promise<void> {
  const key = username.toLowerCase();
  const prev = await db.decisions.get(key);

  await db.transaction('rw', db.decisions, db.events, async () => {
    if (state === null) {
      await db.decisions.delete(key);
    } else {
      await db.decisions.put({
        username: key,
        state,
        updatedAt: Date.now(),
        sourceScanId: snapshotId,
        href: href ?? prev?.href ?? null,
        stillPresent: false,
      });
    }
    await recordEvent(
      key,
      state === null
        ? 'reset'
        : prev?.state === state
          ? ACTION_FOR_STATE[state]
          : ACTION_FOR_STATE[state],
      prev?.state ?? null,
      state,
      snapshotId,
    );
  });
}

// ── Ingest pipeline ──────────────────────────────────────────────────────────

export interface IngestResult {
  snapshot: Snapshot;
  comparison: Comparison | null;
  duplicateOf: Snapshot | null;
  /** decision usernames whose queued/handled_self state was verified by this scan */
  reconciledVerified: number;
  /** handled_self accounts still present in this scan (spec §22 empathy case) */
  stillPresent: number;
}

/**
 * Persist a freshly parsed export as a snapshot, reconcile prior decisions
 * against it (spec §22), and compute a comparison against the previous scan.
 */
export async function ingestParsedExport(
  parsed: ParsedExport,
  file: File,
  fileHash: string,
): Promise<IngestResult> {
  const duplicateOf = (await db.snapshots.where('fileHash').equals(fileHash).first()) ?? null;

  const snapshotId = crypto.randomUUID();
  const { relations, counts } = analyzeExport(parsed, snapshotId);

  const snapshot: Snapshot = {
    id: snapshotId,
    createdAt: Date.now(),
    fileName: file.name,
    fileHash,
    fileLastModified: file.lastModified || null,
    counts,
    partial: parsed.partial,
  };

  // Latest prior snapshot (excluding an exact duplicate re-scan of the same file)
  const priorSnapshots = await db.snapshots.orderBy('createdAt').reverse().toArray();
  const previous = priorSnapshots.find((s) => s.fileHash !== fileHash) ?? null;

  let comparison: Comparison | null = null;
  let reconciledVerified = 0;
  let stillPresent = 0;

  await db.transaction(
    'rw',
    [db.snapshots, db.relations, db.decisions, db.comparisons, db.events, db.settings],
    async () => {
      await db.snapshots.put(snapshot);
      await db.relations.bulkAdd(relations);

      // ── Reconciliation (spec §22): decisions meet the new graph ──
      const nowFollowing = new Set(
        relations
          .filter((r) => r.direction === 'following' || r.direction === 'mutual')
          .map((r) => r.username.toLowerCase()),
      );
      const decisions = await db.decisions.toArray();
      for (const d of decisions) {
        if (d.state === 'handled_self' && !nowFollowing.has(d.username)) {
          await db.decisions.update(d.username, { state: 'handled_verified', stillPresent: false, updatedAt: Date.now(), sourceScanId: snapshotId });
          await recordEvent(d.username, 'handled_verified', 'handled_self', 'handled_verified', snapshotId);
          reconciledVerified++;
        } else if (d.state === 'handled_self' && nowFollowing.has(d.username)) {
          // Still appears — the unfollow may not have completed (empathy, not blame).
          await db.decisions.update(d.username, { stillPresent: true, updatedAt: Date.now() });
          stillPresent++;
        } else if (d.state === 'queued' && !nowFollowing.has(d.username)) {
          await db.decisions.update(d.username, { state: 'handled_verified', stillPresent: false, updatedAt: Date.now(), sourceScanId: snapshotId });
          await recordEvent(d.username, 'handled_verified', 'queued', 'handled_verified', snapshotId);
          reconciledVerified++;
        }
      }

      // ── Comparison (memory — the paid product, spec §8.6) ──
      if (previous) {
        const prevRelations = await db.relations.where('snapshotId').equals(previous.id).toArray();
        comparison = diffSnapshots(prevRelations, relations, decisions, previous.id, snapshotId);
        await db.comparisons.put(comparison);
      }

      // New scan resets the review session (spec §11: announced by toast in UI).
      await db.settings.put({
        ...(await getSettings()),
        pendingJobFileName: null,
        reviewSession: null,
      });
    },
  );

  return { snapshot, comparison, duplicateOf, reconciledVerified, stillPresent };
}

// ── Deletion (spec §14 — "how do I make it gone") ────────────────────────────

export async function deleteSnapshot(snapshotId: string): Promise<void> {
  await db.transaction('rw', [db.snapshots, db.relations, db.comparisons], async () => {
    await db.snapshots.delete(snapshotId);
    await db.relations.where('snapshotId').equals(snapshotId).delete();
    await db.comparisons
      .filter((c) => c.fromSnapshotId === snapshotId || c.toSnapshotId === snapshotId)
      .delete();
  });
}

export async function deleteEverything(): Promise<void> {
  await db.transaction(
    'rw',
    [db.snapshots, db.relations, db.decisions, db.comparisons, db.events, db.settings, db.cleanupBatches],
    async () => {
      await Promise.all([
        db.snapshots.clear(),
        db.relations.clear(),
        db.decisions.clear(),
        db.comparisons.clear(),
        db.events.clear(),
        db.settings.clear(),
        db.cleanupBatches.clear(),
      ]);
    },
  );
}
