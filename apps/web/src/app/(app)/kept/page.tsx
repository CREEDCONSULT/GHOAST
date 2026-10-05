'use client';

/**
 * S-12 Kept — the sanctum. Protected accounts never appear in Review, Ghosts
 * default views, or the cleanup queue, and survive all future scans (spec §10
 * S-12, §22). Removing protection returns the account to the eligible pool.
 */

import { useLiveQuery } from 'dexie-react-hooks';
import { AccountList, rowActionsFor, type ListItem } from '@/components/AccountList';
import { useToast } from '@/components/Toast';
import { formatDate } from '@/lib/analysis';
import { copy } from '@/lib/copy';
import { db } from '@/lib/db';
import { setDecision } from '@/lib/store';

export default function KeptPage() {
  const { show } = useToast();

  const data = useLiveQuery(async () => {
    const kept = await db.decisions.where('state').equals('kept').toArray();
    const snapshots = await db.snapshots.orderBy('createdAt').reverse().toArray();
    const snapshot = snapshots[0] ?? null;
    const relations = snapshot
      ? await db.relations.where('snapshotId').equals(snapshot.id).toArray()
      : [];
    const byUser = new Map(relations.map((r) => [r.username.toLowerCase(), r]));
    const items = kept.map((d) => ({
      relation:
        byUser.get(d.username) ??
        ({
          snapshotId: snapshot?.id ?? '',
          username: d.username,
          href: d.href,
          direction: 'following' as const,
          followingSince: null,
          followerSince: null,
        }),
      decision: 'kept' as const,
      protectedSince: d.updatedAt,
    }));
    return { snapshot, items };
  }, []);

  if (data === undefined) {
    return (
      <div className="page">
        <h1>{copy.kept.title}</h1>
        <AccountList items={[]} emptyMessage={copy.kept.empty} skeleton />
      </div>
    );
  }

  return (
    <div className="page">
      <h1>{copy.kept.title}</h1>
      {data.items.length === 0 ? (
        <div className="card center">
          <p className="ghost-hero" aria-hidden="true">🛡</p>
          <p className="muted" style={{ margin: 0 }}>{copy.kept.empty}</p>
        </div>
      ) : (
        <AccountList
          items={data.items satisfies ListItem[]}
          emptyMessage={copy.kept.empty}
          showBandFilters={false}
          stateChips={false}
          renderActions={(item) => {
            const record = data.items.find(
              (i) => i.relation.username === item.relation.username,
            );
            return (
              <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <span className="caption faint">
                  {record && copy.kept.protectedSince(formatDate(record.protectedSince))}
                </span>
                <button
                  className="btn btn-sm btn-secondary"
                  onClick={() =>
                    void setDecision(item.relation.username, item.relation.href, null, data.snapshot?.id ?? '').then(() =>
                      show(copy.kept.removedToast(item.relation.username)),
                    )
                  }
                >
                  {copy.kept.remove}
                </button>
                {rowActionsFor(item.relation.username, item.relation.href)}
              </span>
            );
          }}
        />
      )}
    </div>
  );
}
