'use client';

/**
 * S-11 Saved — the parking lot. "Resume reviewing" un-saves an account so it
 * re-enters the deck.
 */

import { useRouter } from 'next/navigation';
import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect } from 'react';
import { AccountList, rowActionsFor, type ListItem } from '@/components/AccountList';
import { useToast } from '@/components/Toast';
import { copy } from '@/lib/copy';
import { db } from '@/lib/db';
import { setDecision } from '@/lib/store';

export default function SavedPage() {
  const router = useRouter();
  const { show } = useToast();

  const data = useLiveQuery(async () => {
    const snapshots = await db.snapshots.orderBy('createdAt').reverse().limit(1).toArray();
    const snapshot = snapshots[0] ?? null;
    if (!snapshot) return null;
    const saved = await db.decisions.where('state').equals('saved').toArray();
    const relations = await db.relations.where('snapshotId').equals(snapshot.id).toArray();
    const byUser = new Map(relations.map((r) => [r.username.toLowerCase(), r]));
    const items: ListItem[] = [];
    for (const d of saved) {
      const relation = byUser.get(d.username);
      if (relation) items.push({ relation, decision: 'saved' }); // absent from current scan → dropped
    }
    return { snapshot, items };
  }, []);

  const needsUpload = data === null;
  useEffect(() => {
    if (needsUpload) router.replace('/upload');
  }, [needsUpload, router]);

  if (data === undefined || data === null) {
    return (
      <div className="page">
        <h1>{copy.saved.title}</h1>
        <AccountList items={[]} emptyMessage={copy.saved.empty} skeleton />
      </div>
    );
  }

  return (
    <div className="page">
      <h1>{copy.saved.title}</h1>
      <AccountList
        items={data.items}
        emptyMessage={copy.saved.empty}
        showBandFilters
        stateChips={false}
        renderActions={(item) => (
          <span style={{ display: 'flex', gap: 4 }}>
            <button
              className="btn btn-sm btn-secondary"
              onClick={() =>
                void setDecision(item.relation.username, item.relation.href, null, data.snapshot.id).then(() =>
                  show(copy.review.undoPrefix('Back in the deck —', item.relation.username)),
                )
              }
            >
              {copy.saved.resume}
            </button>
            {rowActionsFor(item.relation.username, item.relation.href)}
          </span>
        )}
      />
    </div>
  );
}
