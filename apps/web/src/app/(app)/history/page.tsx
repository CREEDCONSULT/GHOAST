'use client';

/**
 * S-15 History — scan timeline. Gated behind GHOAST+ ("memory is the paid
 * product", spec §8.7). Dismissible paywall; free users keep everything they
 * already had — the latest scan itself is never locked.
 */

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useState } from 'react';
import { PaywallSheet } from '@/components/Paywall';
import { formatDate } from '@/lib/analysis';
import { copy } from '@/lib/copy';
import { db } from '@/lib/db';
import { getSettings } from '@/lib/store';

export default function HistoryPage() {
  const router = useRouter();
  const [paywallOpen, setPaywallOpen] = useState(false);

  const data = useLiveQuery(async () => {
    const snapshots = await db.snapshots.orderBy('createdAt').reverse().toArray();
    const comparisons = await db.comparisons.toArray();
    const settings = await getSettings();
    return { snapshots, comparisons, plan: settings.plan };
  }, []);

  const needsUpload = !!data && data.snapshots.length === 0;
  useEffect(() => {
    if (needsUpload) router.replace('/upload');
  }, [needsUpload, router]);

  if (!data || needsUpload) {
    return <div className="page" aria-busy="true"><div className="skeleton" style={{ height: 320 }} /></div>;
  }

  const gated = data.plan !== 'plus';

  return (
    <div className="page">
      <h1>{copy.history.title}</h1>

      {gated && (
        <div className="card" style={{ borderColor: 'var(--accent)' }}>
          <p style={{ margin: 0 }}>{copy.history.gatedBody}</p>
          <button className="btn btn-primary mt-4" onClick={() => setPaywallOpen(true)}>
            {copy.paywall.comparisonTrigger}
          </button>
        </div>
      )}

      {data.snapshots.length <= 1 ? (
        <p className="muted mt-4">{copy.history.empty}</p>
      ) : (
        <div className="stack-lg mt-4">
          {data.snapshots.map((s, i) => {
            const prev = data.snapshots[i + 1];
            const comparison = prev
              ? data.comparisons.find((c) => c.fromSnapshotId === prev.id && c.toSnapshotId === s.id)
              : null;
            return (
              <div key={s.id} className="card">
                <div className="spread">
                  <div>
                    <strong>{copy.board.scanOf(formatDate(s.createdAt))}</strong>
                    <p className="micro muted" style={{ margin: '4px 0 0' }}>
                      <span className="tnum">{s.counts.ghosts.toLocaleString()}</span> ghosts ·{' '}
                      <span className="tnum">{s.counts.following.toLocaleString()}</span> following
                    </p>
                  </div>
                  {comparison && (
                    <span className="chip-row" style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      <span className="delta delta-positive">+{comparison.becameMutual.length} ✨</span>
                      <span className="delta delta-negative">−{comparison.youUnfollowed.length}</span>
                    </span>
                  )}
                </div>
                {comparison && (
                  <p className="mt-2" style={{ margin: 0 }}>
                    {gated ? (
                      <button className="btn-tertiary btn-sm" onClick={() => setPaywallOpen(true)}>
                        {copy.paywall.comparisonTrigger} 🔒
                      </button>
                    ) : (
                      <Link className="btn-tertiary btn-sm" href={`/history/${encodeURIComponent(comparison.id)}`}>
                        {copy.history.groups.newGhosts} +{comparison.newGhosts.length} ·{' '}
                        {copy.history.groups.youUnfollowed} {comparison.youUnfollowed.length} →
                      </Link>
                    )}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}

      <PaywallSheet open={paywallOpen} onDismiss={() => setPaywallOpen(false)} />
    </div>
  );
}
