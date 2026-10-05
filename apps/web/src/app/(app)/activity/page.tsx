'use client';

/**
 * S-14 Activity ledger + cleanup queue execution (spec §8.5, §S-14).
 * Tabs: Handled (self-reported ✓ / verified ✓✓) · Queued (the cleanup queue,
 * with Open-in-Instagram deep links + pacing) · Kept · Saved · Skipped-from-events.
 * Every row reversible: "Move back to unreviewed". Honesty: queued/handled
 * never pretend the unfollow actually happened.
 */

import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useRef, useState } from 'react';
import { track } from '@/lib/analytics';
import { Monogram } from '@/components/Monogram';
import { openInInstagram } from '@/components/ReturnConfirm';
import { useToast } from '@/components/Toast';
import { formatDate } from '@/lib/analysis';
import { copy } from '@/lib/copy';
import { db } from '@/lib/db';
import { setDecision } from '@/lib/store';
import type { DecisionState } from '@/lib/types';

type Tab = 'handled' | 'queued' | 'kept' | 'saved';

const TAB_STATES: Record<Tab, DecisionState[]> = {
  handled: ['handled_self', 'handled_verified'],
  queued: ['queued'],
  kept: ['kept'],
  saved: ['saved'],
};

export default function ActivityPage() {
  const [tab, setTab] = useState<Tab>('queued');
  const { show } = useToast();
  const tracked = useRef(false);
  useEffect(() => {
    if (!tracked.current) {
      tracked.current = true;
      void track('cleanup_queue_open');
    }
  }, []);

  const data = useLiveQuery(async () => {
    const snapshots = await db.snapshots.orderBy('createdAt').reverse().toArray();
    const snapshot = snapshots[0] ?? null;
    const decisions = await db.decisions.toArray();
    decisions.sort((a, b) => b.updatedAt - a.updatedAt);
    const skipped = await db.events.where('action').equals('skipped').reverse().limit(50).toArray();
    return { snapshot, decisions, skipped };
  }, []);

  if (!data) {
    return <div className="page" aria-busy="true"><div className="skeleton" style={{ height: 320 }} /></div>;
  }

  const rows = data.decisions.filter((d) => TAB_STATES[tab].includes(d.state));

  return (
    <div className="page">
      <h1>{copy.activity.title}</h1>
      <p className="micro muted">{copy.cleanup.intro}</p>

      <div className="chip-row" role="tablist" style={{ display: 'flex', gap: 8, margin: '16px 0', flexWrap: 'wrap' }}>
        {(Object.keys(TAB_STATES) as Tab[]).map((t) => (
          <button key={t} role="tab" aria-selected={tab === t} className={`chip ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>
            {copy.activity.tabs[t]}{' '}
            <span className="tnum">{data.decisions.filter((d) => TAB_STATES[t].includes(d.state)).length}</span>
          </button>
        ))}
      </div>

      {data.decisions.length === 0 ? (
        <div className="card center">
          <p className="muted" style={{ margin: 0 }}>{copy.activity.empty}</p>
        </div>
      ) : rows.length === 0 ? (
        <div className="card center">
          <p className="muted" style={{ margin: 0 }}>{copy.cleanup.empty}</p>
        </div>
      ) : (
        <div className="list-container">
          {rows.map((d) => (
            <div key={d.username} className="row">
              <Monogram username={d.username} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <strong>
                  <bdi>@{d.username}</bdi>
                </strong>
                <div className="micro muted">
                  {d.state === 'handled_self' &&
                    (d.stillPresent ? copy.cleanup.stillThereNote : copy.activity.handledSelf)}
                  {d.state === 'handled_verified' &&
                    copy.cleanup.verifiedNote(formatDate(d.updatedAt))}
                  {d.state === 'queued' && copy.lists.stateChips.queued}
                  {d.state === 'kept' && copy.kept.protectedSince(formatDate(d.updatedAt))}
                  {d.state === 'saved' && copy.lists.stateChips.saved}
                </div>
              </div>
              {d.state === 'queued' && (
                <button
                  className="btn btn-sm btn-primary"
                  onClick={() => openInInstagram(d.username, d.href)}
                >
                  {copy.cleanup.open}
                </button>
              )}
              {d.state !== 'handled_verified' && (
                <button
                  className="btn-tertiary btn-sm"
                  onClick={() =>
                    void setDecision(d.username, d.href, null, data.snapshot?.id ?? '').then(() =>
                      show(copy.activity.moveBack),
                    )
                  }
                >
                  {copy.activity.moveBack}
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
