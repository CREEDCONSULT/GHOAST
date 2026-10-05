'use client';

/**
 * Shared list screen for Ghosts / Fans / Mutuals (S-07/08/09). Thin variant
 * shell around the list engine; bulk Keep/Save only (spec §12: bulk Queue is
 * deliberately omitted — bulk-queuing invites regret spirals and mass-unfollow
 * velocity that Instagram punishes).
 */

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useMemo } from 'react';
import { AccountList, rowActionsFor, type BandFilter, type ListItem } from '@/components/AccountList';
import { useToast } from '@/components/Toast';
import { createBatch } from '@/lib/cleanup';
import { copy } from '@/lib/copy';
import { db } from '@/lib/db';
import { setDecision } from '@/lib/store';
import type { Direction } from '@/lib/types';

interface ListPageProps {
  direction: Direction;
  title: string;
  emptyMessage: string;
  initialBand?: BandFilter;
  showBandFilters?: boolean;
  showReviewFab?: boolean;
}

export function ListPage({ direction, title, emptyMessage, initialBand, showBandFilters, showReviewFab }: ListPageProps) {
  const router = useRouter();
  const { show } = useToast();

  const data = useLiveQuery(async () => {
    const snapshots = await db.snapshots.orderBy('createdAt').reverse().limit(1).toArray();
    const snapshot = snapshots[0] ?? null;
    if (!snapshot) return null;
    const relations = await db.relations
      .where('[snapshotId+direction]')
      .equals([snapshot.id, direction])
      .toArray();
    const decisions = await db.decisions.toArray();
    const decided = new Map(decisions.map((d) => [d.username, d.state]));
    return { snapshot, relations, decided };
  }, [direction]);

  const items: ListItem[] = useMemo(() => {
    if (!data) return [];
    return data.relations
      .filter((r) => {
        const state = data.decided.get(r.username.toLowerCase());
        // Kept is a sanctum (spec §S-12): hidden from Ghosts lists by default.
        if (direction === 'following' && state === 'kept') return false;
        return true;
      })
      .map((r) => ({ relation: r, decision: data.decided.get(r.username.toLowerCase()) ?? null }));
  }, [data, direction]);

  const needsUpload = data === null;
  useEffect(() => {
    if (needsUpload) router.replace('/upload');
  }, [needsUpload, router]);

  if (data === undefined || data === null) {
    return (
      <div className="page">
        <h1>{title}</h1>
        <AccountList items={[]} emptyMessage={emptyMessage} skeleton />
      </div>
    );
  }

  const snapshotId = data.snapshot.id;

  return (
    <div className="page">
      <div className="spread">
        <h1 style={{ margin: 0 }}>
          {title} <span className="stat-value tnum" style={{ fontSize: '1.25rem' }}>{items.length.toLocaleString()}</span>
        </h1>
      </div>
      {direction === 'following' && <p className="micro faint">{copy.board.statSortNote}</p>}

      <AccountList
        items={items}
        emptyMessage={emptyMessage}
        showBandFilters={showBandFilters ?? direction === 'following'}
        initialBand={initialBand}
        batchTools={
          direction === 'following'
            ? {
                onCreateBatch: (usernames) => {
                  void createBatch({ usernames, sourceSnapshotId: snapshotId })
                    .then(() => router.push('/cleanup'))
                    .catch(() => show('Nothing to batch — those accounts are protected or already queued in a batch.'));
                },
              }
            : undefined
        }
        stateChips
        bulkActions={{
          onKeep: (usernames) => {
            void Promise.all(usernames.map((u) => setDecision(u, null, 'kept', snapshotId))).then(() =>
              show(copy.lists.keepSelected),
            );
          },
          onSave: (usernames) => {
            void Promise.all(usernames.map((u) => setDecision(u, null, 'saved', snapshotId))).then(() =>
              show(copy.lists.saveSelected),
            );
          },
        }}
        renderActions={(item) => (
          <span style={{ display: 'flex', gap: 4 }}>
            <button
              className="btn-tertiary btn-sm"
              title={copy.lists.keep}
              onClick={() => {
                const row = item.relation;
                void setDecision(row.username, row.href, 'kept', snapshotId).then(() =>
                  show(copy.review.undoPrefix('Kept', row.username), () =>
                    void setDecision(row.username, row.href, null, snapshotId),
                  ),
                );
              }}
            >
              🛡
            </button>
            {rowActionsFor(item.relation.username, item.relation.href)}
          </span>
        )}
      />

      {showReviewFab && (
        <Link href="/review" className="btn btn-primary fab">
          🃏 Review
        </Link>
      )}
    </div>
  );
}
