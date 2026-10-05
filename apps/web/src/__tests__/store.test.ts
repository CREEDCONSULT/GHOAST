/**
 * Store integration tests (fake-indexeddb): ingest → reconciliation →
 * duplicate detection → delete everything (spec §22 lifecycle coverage).
 */

import { db } from '@/lib/db';
import { deleteEverything, ingestParsedExport, setDecision } from '@/lib/store';
import { buildExportZip } from './helpers';
import { parseInstagramExport } from '@/lib/parser/instagram-dyi';

async function ingest(following: { username: string }[], followers: { username: string }[], name: string) {
  const file = buildExportZip({ following, followers, name });
  const parsed = await parseInstagramExport(file);
  const hash = `test-hash-${name}`;
  return ingestParsedExport(parsed, file, hash);
}

describe('store', () => {
  beforeEach(async () => {
    await deleteEverything();
  });

  it('ingests a snapshot and computes counts', async () => {
    const { snapshot } = await ingest(
      [{ username: 'a' }, { username: 'b' }],
      [{ username: 'a' }],
      'scan1.zip',
    );
    expect(snapshot.counts).toEqual({ following: 2, followers: 1, mutuals: 1, ghosts: 1, fans: 0 });
    const relations = await db.relations.where('snapshotId').equals(snapshot.id).toArray();
    // one row per account: 'a' (mutual) + 'b' (ghost); fan-only accounts would add rows
    expect(relations).toHaveLength(2);
  });

  it('detects duplicate scans by file hash', async () => {
    const first = await ingest([{ username: 'a' }], [], 'scan.zip');
    const again = await ingest([{ username: 'a' }], [], 'scan.zip');
    expect(again.duplicateOf?.id).toBe(first.snapshot.id);
  });

  it('reconciles queued → handled_verified when the account leaves the next scan', async () => {
    const first = await ingest([{ username: 'a' }, { username: 'b' }], [], 'scan1.zip');
    await setDecision('b', null, 'queued', first.snapshot.id);

    const second = await ingest([{ username: 'a' }], [], 'scan2.zip');
    expect(second.reconciledVerified).toBe(1);
    const d = await db.decisions.get('b');
    expect(d?.state).toBe('handled_verified');

    // and the comparison records the verified unfollow
    const comparison = second.comparison;
    expect(comparison?.youUnfollowed).toEqual(['b']);
  });

  it('flags handled_self accounts still present in the next scan (empathy case, spec §22)', async () => {
    const first = await ingest([{ username: 'a' }, { username: 'b' }], [], 'scan1.zip');
    await setDecision('b', null, 'handled_self', first.snapshot.id);

    const second = await ingest([{ username: 'a' }, { username: 'b' }], [], 'scan2.zip');
    expect(second.stillPresent).toBe(1);
    const d = await db.decisions.get('b');
    expect(d?.state).toBe('handled_self');
    expect(d?.stillPresent).toBe(true);
  });

  it('keeps Kept decisions across scans regardless of graph changes', async () => {
    const first = await ingest([{ username: 'mom' }], [], 'scan1.zip');
    await setDecision('mom', null, 'kept', first.snapshot.id);
    await ingest([{ username: 'someoneelse' }], [], 'scan2.zip');
    const d = await db.decisions.get('mom');
    expect(d?.state).toBe('kept');
  });

  it('deleteEverything wipes all stores', async () => {
    const first = await ingest([{ username: 'a' }], [], 'scan1.zip');
    await setDecision('a', null, 'queued', first.snapshot.id);
    await deleteEverything();
    expect(await db.snapshots.count()).toBe(0);
    expect(await db.relations.count()).toBe(0);
    expect(await db.decisions.count()).toBe(0);
    expect(await db.events.count()).toBe(0);
    expect(await db.settings.count()).toBe(0);
  });
});
