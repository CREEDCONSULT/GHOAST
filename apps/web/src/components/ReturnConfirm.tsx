'use client';

/**
 * SH-6 return-confirm + SH-7 break sheet + cleanup "Open in Instagram"
 * pacing logic. Mounted once in the app shell layout.
 *
 * Contract (spec §8.5): user taps "Open in Instagram ↗" → we remember the
 * pending account → when the app regains focus we ask "Did you unfollow
 * @name?" — Yes (self-reported, labeled as such) / Not yet / Keep them.
 * Pacing: after N opens (settings.pacingThreshold, default 25) a break
 * sheet gently interrupts (spec §12: "Pace protects").
 */

import { useCallback, useEffect, useState } from 'react';
import { profileUrl } from '@/lib/analysis';
import { getActiveBatches, recordReceipt } from '@/lib/cleanup';
import { copy } from '@/lib/copy';
import { db } from '@/lib/db';
import { getSettings, setDecision, updateSettings } from '@/lib/store';
import { Sheet } from './Sheet';
import { useToast } from './Toast';

const PENDING_KEY = 'ghoast-pending-open';

interface PendingOpen {
  username: string;
  href: string | null;
  openedAt: number;
}

export function openInInstagram(username: string, href: string | null) {
  try {
    const pending: PendingOpen = { username: username.toLowerCase(), href, openedAt: Date.now() };
    sessionStorage.setItem(PENDING_KEY, JSON.stringify(pending));
  } catch {
    /* private mode */
  }
  window.open(profileUrl(username, href), '_blank', 'noopener,noreferrer');
}

export function ReturnConfirm() {
  const [pending, setPending] = useState<PendingOpen | null>(null);
  const [breakOpen, setBreakOpen] = useState(false);
  const [opensCount, setOpensCount] = useState(0);
  const { show } = useToast();

  const handleReturn = useCallback(async () => {
    if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
    let raw: string | null = null;
    try {
      raw = sessionStorage.getItem(PENDING_KEY);
    } catch {
      return;
    }
    if (!raw) return;
    try {
      sessionStorage.removeItem(PENDING_KEY);
    } catch {
      /* ignore */
    }
    const p = JSON.parse(raw) as PendingOpen;
    // Ignore returns older than 30 minutes — too vague to confirm against.
    if (Date.now() - p.openedAt > 30 * 60 * 1000) return;

    const settings = await getSettings();
    const session = settings.reviewSession;
    const opens = (session?.opensSinceBreak ?? 0) + 1;
    await updateSettings({
      reviewSession: { snapshotId: session?.snapshotId ?? '', done: session?.done ?? 0, opensSinceBreak: opens },
    });
    setOpensCount(opens);
    if (opens >= settings.pacingThreshold && settings.pacingThreshold > 0) {
      setBreakOpen(true);
    }
    setPending(p);
  }, []);

  useEffect(() => {
    document.addEventListener('visibilitychange', handleReturn);
    window.addEventListener('focus', handleReturn);
    return () => {
      document.removeEventListener('visibilitychange', handleReturn);
      window.removeEventListener('focus', handleReturn);
    };
  }, [handleReturn]);

  const resolve = async (outcome: 'yes' | 'no' | 'keep') => {
    if (!pending) return;
    const snaps = await db.snapshots.orderBy('createdAt').reverse().limit(1).toArray();
    const snapshotId = snaps[0]?.id ?? '';

    // Batch integration: if this account is the current item of an active
    // batch, the answer becomes a batch receipt too.
    const activeBatches = await getActiveBatches();
    const batch = activeBatches.find(
      (b) => b.status === 'running' && b.usernames[b.currentIndex] === pending.username,
    );

    if (outcome === 'yes') {
      await setDecision(pending.username, pending.href, 'handled_self', snapshotId);
      if (batch) await recordReceipt(batch.id, pending.username, 'confirmed');
      show(copy.cleanup.selfReportNote);
    } else if (outcome === 'keep') {
      await setDecision(pending.username, pending.href, 'kept', snapshotId);
      if (batch) await recordReceipt(batch.id, pending.username, 'skipped', 'protected instead');
      show(copy.review.undoPrefix('Kept', pending.username));
    }
    // 'no' → leave the decision queued; nothing to change.
    setPending(null);
  };

  return (
    <>
      <Sheet
        open={pending !== null && !breakOpen}
        title={pending ? copy.cleanup.confirmTitle(pending.username) : ''}
        onClose={pending ? () => void resolve('no') : undefined}
      >
        <div className="stack mt-2">
          <button className="btn btn-primary" onClick={() => void resolve('yes')}>
            {copy.cleanup.confirmYes}
          </button>
          <button className="btn btn-secondary" onClick={() => void resolve('no')}>
            {copy.cleanup.confirmNo}
          </button>
          <button className="btn btn-tertiary" onClick={() => void resolve('keep')}>
            {copy.cleanup.confirmKeep}
          </button>
        </div>
      </Sheet>

      <Sheet open={breakOpen} title={copy.cleanup.breakTitle}>
        <p className="muted">{copy.cleanup.breakBody(opensCount)}</p>
        <div className="stack mt-4">
          <button
            className="btn btn-primary"
            onClick={() => {
              void updateSettings({
                reviewSession: { snapshotId: '', done: 0, opensSinceBreak: 0 },
              }).then(() => setBreakOpen(false));
            }}
          >
            {copy.cleanup.breakResume}
          </button>
          <button className="btn btn-secondary" onClick={() => setBreakOpen(false)}>
            {copy.cleanup.breakSnooze}
          </button>
        </div>
      </Sheet>
    </>
  );
}
