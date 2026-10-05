'use client';

/**
 * /cleanup — Batch Cleanup Assistant v1, web surface.
 *
 * Two drivers share one ledger:
 *  - manual: GHOAST opens instagram.com/<username>; the return-confirm sheet
 *    turns the user's answer into receipts + decisions (handled_self).
 *  - extension: the Chrome Companion drives the same sequence after an
 *    explicit user Start; receipts sync back here and land identically.
 * Neither path can create handled_verified — only a future export can.
 */

import Link from 'next/link';
import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useRef, useState } from 'react';
import { Monogram } from '@/components/Monogram';
import { openInInstagram } from '@/components/ReturnConfirm';
import { useToast } from '@/components/Toast';
import {
  currentItem,
  estimatedMinutesRemaining,
  getLatestBatch,
  recordReceipt,
  remainingCount,
  setBatchStatus,
  updateBatchPacing,
} from '@/lib/cleanup';
import { copy } from '@/lib/copy';
import { db } from '@/lib/db';
import { extensionAvailable, sendToExtension } from '@/lib/extension';
import { setDecision } from '@/lib/store';

const C = copy.cleanupBatch;

export default function CleanupPage() {
  const { show } = useToast();
  const [assistant] = useState(() => (typeof window !== 'undefined' ? extensionAvailable() : false));
  const syncCursor = useRef(0); // receipts applied so far (extension driver)
  const polling = useRef<ReturnType<typeof setInterval> | null>(null);

  const batch = useLiveQuery(() => getLatestBatch(), []);

  // Extension driver: poll receipts while running.
  useEffect(() => {
    if (!batch || batch.driver !== 'extension' || batch.status !== 'running') return;
    polling.current = setInterval(() => {
      void sendToExtension({ type: 'GHOAST_BATCH_STATUS' }).then(async (state) => {
        if (!state) return;
        const fresh = state.receipts.slice(syncCursor.current);
        for (const r of fresh) {
          await applyReceipt(batch.id, r.username, r.kind, r.detail);
          syncCursor.current++;
        }
        if (state.status === 'stopped' && state.haltedReason) {
          await setBatchStatus(batch.id, 'stopped');
          show(C.challengeStop);
        }
        if (state.status === 'done') await setBatchStatus(batch.id, 'done');
      });
    }, 2000);
    return () => {
      if (polling.current) clearInterval(polling.current);
    };
  }, [batch?.id, batch?.driver, batch?.status]); // eslint-disable-line react-hooks/exhaustive-deps

  async function applyReceipt(
    batchId: string,
    username: string,
    kind: 'opened' | 'requested' | 'confirmed' | 'skipped' | 'failed' | 'stopped',
    detail?: string,
  ) {
    await recordReceipt(batchId, username, kind, detail);
    if (kind === 'confirmed') {
      // Self-reported — never verified. Verified comes only from the next scan.
      await setDecision(username, null, 'handled_self', batch?.sourceSnapshotId ?? '');
    }
  }

  if (batch === undefined) {
    return <div className="page" aria-busy="true"><div className="skeleton" style={{ height: 320 }} /></div>;
  }

  if (batch === null) {
    return (
      <div className="page center" style={{ maxWidth: 480 }}>
        <p className="ghost-hero" aria-hidden="true">🧹</p>
        <h1>{C.emptyTitle}</h1>
        <p className="muted">{C.emptyBody}</p>
        <p className="mt-4">
          <Link href="/results/ghosts" className="btn btn-primary">{C.goToGhosts}</Link>
        </p>
      </div>
    );
  }

  const current = currentItem(batch);
  const done = batch.completed + batch.skipped + batch.failed; // processed, however it went
  const total = batch.usernames.length;
  const failures = batch.receipts.filter((r) => r.kind === 'failed');
  const isTerminal = batch.status === 'stopped' || batch.status === 'done';

  const openCurrent = () => {
    if (!current) return;
    void recordReceipt(batch.id, current, 'opened');
    void setBatchStatus(batch.id, 'running');
    openInInstagram(current, null);
  };

  const startAssistant = async () => {
    const state = await sendToExtension({
      type: 'GHOAST_BATCH_START',
      usernames: batch.usernames.slice(batch.currentIndex),
      pacing: batch.pacing,
    });
    if (!state) {
      show(C.assistantMissing);
      return;
    }
    syncCursor.current = 0;
    await db.cleanupBatches.update(batch.id, { driver: 'extension', status: 'running' });
  };

  const skipCurrent = () => {
    if (!current) return;
    void applyReceipt(batch.id, current, 'skipped').then(() => show(`Skipped @${current}`));
  };

  const stopBatch = async () => {
    await sendToExtension({ type: 'GHOAST_BATCH_STOP' });
    await recordReceipt(batch.id, current ?? '', 'stopped', 'user stopped the batch');
    await setBatchStatus(batch.id, 'stopped');
  };

  return (
    <div className="page" style={{ maxWidth: 520 }}>
      <div className="spread">
        <h1 style={{ margin: 0 }}>{C.title}</h1>
        <span className="chip" aria-live="polite">{C.statusLabel[batch.status]}</span>
      </div>
      <p className="micro muted">{C.selected(total)} · {C.verdictNote}</p>

      <div className="progress-track mt-2" role="progressbar" aria-label={C.progress(done, total)} aria-valuemin={0} aria-valuemax={total} aria-valuenow={done}>
        <div className="progress-fill" style={{ width: total ? `${(done / total) * 100}%` : '0%' }} />
      </div>
      <p className="micro faint mt-2">
        {C.progress(done, total)} · {C.remaining(remainingCount(batch))} · {C.estimated(estimatedMinutesRemaining(batch))}
      </p>

      {current && !isTerminal && (
        <div className="card center mt-4">
          <p className="caption muted">{C.current}</p>
          <Monogram username={current} size={64} />
          <h2 className="mt-2" style={{ marginBottom: 0 }}>
            <bdi>@{current}</bdi>
          </h2>
          <div className="stack mt-4">
            {batch.driver === 'extension' && assistant ? (
              <p className="micro muted">{C.assistantHint}</p>
            ) : (
              <>
                <button className="btn btn-primary" onClick={openCurrent}>
                  {copy.cleanup.open}
                </button>
                <p className="micro faint">{C.manualHint}</p>
              </>
            )}
          </div>
        </div>
      )}

      {batch.status === 'done' && (
        <div className="card center mt-4">
          <p className="ghost-hero" aria-hidden="true">✨</p>
          <h2>{C.statusLabel.done}</h2>
          <p className="muted">{C.verdictNote}</p>
        </div>
      )}
      {batch.status === 'stopped' && <p className="muted mt-4">{C.restartHint}</p>}

      <div className="action-bar mt-4 wrap">
        {batch.status === 'draft' && (
          <>
            <button className="btn btn-primary" onClick={openCurrent}>{C.start}</button>
            {assistant && (
              <button className="btn btn-secondary" onClick={() => void startAssistant()}>
                {C.start} · 🤖
              </button>
            )}
            {!assistant && <p className="micro faint">{C.assistantMissing}</p>}
          </>
        )}
        {batch.status === 'running' && batch.driver === 'extension' && (
          <button className="btn btn-secondary" onClick={() => { void sendToExtension({ type: 'GHOAST_BATCH_PAUSE' }); void setBatchStatus(batch.id, 'paused'); }}>
            {C.pause}
          </button>
        )}
        {batch.status === 'paused' && (
          <button className="btn btn-primary" onClick={() => { void sendToExtension({ type: 'GHOAST_BATCH_RESUME' }); void setBatchStatus(batch.id, 'running'); }}>
            {C.resume}
          </button>
        )}
        {current && !isTerminal && (
          <button className="btn btn-tertiary" onClick={skipCurrent}>{C.skip}</button>
        )}
        {!isTerminal && (
          <button className="btn btn-danger" onClick={() => void stopBatch()}>{C.stop}</button>
        )}
      </div>

      {batch.driver === 'extension' && (
        <div className="card mt-6">
          <h2 style={{ fontSize: '1.125rem' }}>{C.paceSettings}</h2>
          <label className="micro muted">
            {C.intervalLabel}
            <input
              type="number"
              className="field-input mt-2"
              min={20}
              max={300}
              value={batch.pacing.intervalSeconds}
              onChange={(e) => void updateBatchPacing(batch.id, { ...batch.pacing, intervalSeconds: Number(e.target.value) || DEFAULT_FALLBACK })}
            />
          </label>
        </div>
      )}

      {failures.length > 0 && (
        <div className="card mt-6" style={{ borderColor: 'var(--rose-400)' }}>
          <h2 style={{ fontSize: '1.125rem' }}>{C.failuresTitle}</h2>
          <div className="stack">
            {failures.map((f, i) => (
              <div key={i} className="row" style={{ minHeight: 40 }}>
                <span><bdi>@{f.username}</bdi></span>
                <span className="micro faint">{f.detail ?? '—'}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="card mt-6">
        <h2 style={{ fontSize: '1.125rem' }}>{C.receiptsTitle}</h2>
        {batch.receipts.length === 0 ? (
          <p className="muted" style={{ margin: 0 }}>{C.noReceipts}</p>
        ) : (
          <div className="stack">
            {batch.receipts.slice(-20).reverse().map((r, i) => (
              <div key={i} className="spread micro">
                <span><bdi>@{r.username}</bdi> — {r.kind}</span>
                <span className="faint">{new Date(r.ts).toLocaleTimeString()}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

const DEFAULT_FALLBACK = 45;
