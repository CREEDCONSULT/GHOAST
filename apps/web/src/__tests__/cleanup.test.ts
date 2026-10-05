/**
 * Batch Cleanup Assistant v1 — web-side guarantees (fake-indexeddb).
 */

import { createBatch, currentItem, recordReceipt, remainingCount, selectFirstN, setBatchStatus, getBatch } from '@/lib/cleanup';
import { db } from '@/lib/db';
import { deleteEverything, ingestParsedExport, setDecision } from '@/lib/store';
import { parseInstagramExport } from '@/lib/parser/instagram-dyi';
import { buildExportZip } from './helpers';

async function ingest(following: string[], name: string) {
  const file = buildExportZip({ following: following.map((username) => ({ username })), followers: [], name });
  const parsed = await parseInstagramExport(file);
  return ingestParsedExport(parsed, file, `test-hash-${name}`);
}

describe('cleanup batches', () => {
  beforeEach(async () => {
    await deleteEverything();
  });

  it('selectFirstN respects the caller-provided (filtered+sorted) order', () => {
    const ordered = ['z_last', 'm_mid', 'a_first']; // e.g. sorted Z–A
    expect(selectFirstN(ordered, 2)).toEqual(['z_last', 'm_mid']);
    expect(selectFirstN(ordered, 0)).toEqual([]);
    expect(selectFirstN(ordered, 99)).toEqual(ordered);
  });

  it('persists across refresh (IndexedDB round-trip)', async () => {
    const created = await createBatch({ usernames: ['a', 'b', 'c'], sourceSnapshotId: 's1' });
    const reread = await getBatch(created.id);
    expect(reread?.usernames).toEqual(['a', 'b', 'c']);
    expect(reread?.status).toBe('draft');
  });

  it('cannot include protected (kept) accounts', async () => {
    const { snapshot } = await ingest(['victim', 'mom'], 's1.zip');
    await setDecision('mom', null, 'kept', snapshot.id);

    const batch = await createBatch({ usernames: ['victim', 'mom'], sourceSnapshotId: snapshot.id });
    expect(batch.usernames).toEqual(['victim']);

    await expect(
      createBatch({ usernames: ['mom'], sourceSnapshotId: snapshot.id }),
    ).rejects.toThrow('batch_all_ineligible');
  });

  it('makes duplicate accounts impossible (in-batch and cross-active-batch)', async () => {
    const first = await createBatch({ usernames: ['a', 'a', 'A'], sourceSnapshotId: 's1' });
    expect(first.usernames).toEqual(['a']);

    // Active batch claims 'a'; a second batch asking for it rejects just that account
    const second = await createBatch({ usernames: ['a', 'b'], sourceSnapshotId: 's1' });
    expect(second.usernames).toEqual(['b']);
  });

  it('pause/resume preserves the cursor', async () => {
    const batch = await createBatch({ usernames: ['a', 'b', 'c'], sourceSnapshotId: 's1' });
    await recordReceipt(batch.id, 'a', 'confirmed');
    await setBatchStatus(batch.id, 'paused');
    let now = (await getBatch(batch.id))!;
    expect(now.currentIndex).toBe(1);
    expect(currentItem(now)).toBe('b');

    await setBatchStatus(batch.id, 'running');
    now = (await getBatch(batch.id))!;
    expect(now.currentIndex).toBe(1);
    expect(remainingCount(now)).toBe(2);
  });

  it('confirmed → handled_self ONLY — never handled_verified (verified comes from export reconciliation)', async () => {
    const { snapshot } = await ingest(['target'], 's1.zip');
    const batch = await createBatch({ usernames: ['target'], sourceSnapshotId: snapshot.id });
    await recordReceipt(batch.id, 'target', 'confirmed');
    await setDecision('target', null, 'handled_self', snapshot.id); // what /cleanup does on confirm

    let d = await db.decisions.get('target');
    expect(d?.state).toBe('handled_self');
    expect(d?.state).not.toBe('handled_verified');

    // Batch shows done
    const doneBatch = (await getBatch(batch.id))!;
    expect(doneBatch.status).toBe('done');

    // Next scan without the target → reconciliation verifies
    await ingest([], 's2.zip');
    d = await db.decisions.get('target');
    expect(d?.state).toBe('handled_verified');
  });

  it('failed/ambiguous actions leave relationship decisions unchanged', async () => {
    const { snapshot } = await ingest(['target'], 's1.zip');
    await setDecision('target', null, 'queued', snapshot.id);
    const batch = await createBatch({ usernames: ['target2'], sourceSnapshotId: snapshot.id });
    await recordReceipt(batch.id, 'target2', 'failed', 'controls_not_visible');

    const d = await db.decisions.get('target');
    expect(d?.state).toBe('queued'); // untouched
    const d2 = await db.decisions.get('target2');
    expect(d2).toBeUndefined(); // no phantom decision created
    expect((await getBatch(batch.id))!.status).toBe('done'); // single-item batch completes
  });

  it('challenge/rate-limit stop marks the batch stopped and keeps the cursor', async () => {
    const batch = await createBatch({ usernames: ['a', 'b', 'c'], sourceSnapshotId: 's1' });
    await recordReceipt(batch.id, 'a', 'confirmed');
    await recordReceipt(batch.id, 'b', 'stopped', 'challenge');
    const now = (await getBatch(batch.id))!;
    expect(now.status).toBe('stopped');
    expect(now.currentIndex).toBe(1); // 'b' NOT advanced past — work preserved honestly
    expect(now.receipts.map((r) => r.kind)).toEqual(['confirmed', 'stopped']);
  });
});
