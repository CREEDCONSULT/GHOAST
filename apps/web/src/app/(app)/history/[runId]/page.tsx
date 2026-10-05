'use client';

/**
 * S-16 Comparison detail — delta groups with calm, non-alarmist styling
 * (spec §S-16: lost followers neutral gray, never red; verbs not verdicts).
 * GHOAST+ only.
 */

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect } from 'react';
import { Monogram } from '@/components/Monogram';
import { Beacon } from '@/components/Beacon';
import { PaywallSheet } from '@/components/Paywall';
import { formatDate } from '@/lib/analysis';
import { copy } from '@/lib/copy';
import { db } from '@/lib/db';
import { getSettings } from '@/lib/store';

export default function ComparisonDetailPage() {
  const { runId } = useParams<{ runId: string }>();
  const id = decodeURIComponent(runId);
  const router = useRouter();

  const data = useLiveQuery(async () => {
    const comparison = await db.comparisons.get(id);
    const settings = await getSettings();
    const snapshots = await db.snapshots.toArray();
    return { comparison: comparison ?? null, plan: settings.plan, snapshots };
  }, [id]);

  const missing = !!data && !data.comparison;
  useEffect(() => {
    if (missing) router.replace('/history');
  }, [missing, router]);

  if (!data || missing) {
    return <div className="page" aria-busy="true"><div className="skeleton" style={{ height: 320 }} /></div>;
  }

  if (data.plan !== 'plus') {
    return (
      <div className="page">
        <h1>{copy.history.title}</h1>
        <PaywallSheet open onDismiss={() => router.push('/history')} detail={copy.history.gatedBody} />
      </div>
    );
  }

  const comparisonView = (
    <Beacon event="comparison_view" />
  );

  const c = data.comparison;
  if (!c) {
    return <div className="page" aria-busy="true"><div className="skeleton" style={{ height: 320 }} /></div>;
  }
  const from = data.snapshots.find((s) => s.id === c.fromSnapshotId);
  const to = data.snapshots.find((s) => s.id === c.toSnapshotId);

  const groups: { key: keyof typeof copy.history.groups; list: string[]; deltaClass: string }[] = [
    { key: 'newGhosts', list: c.newGhosts, deltaClass: 'delta-positive' },
    { key: 'becameMutual', list: c.becameMutual, deltaClass: 'delta-positive' },
    { key: 'youUnfollowed', list: c.youUnfollowed, deltaClass: 'delta-negative' },
    { key: 'newFollowers', list: c.newFollowers, deltaClass: 'delta-positive' },
    { key: 'lostFollowers', list: c.lostFollowers, deltaClass: 'delta-negative' },
    { key: 'vanished', list: c.vanished, deltaClass: 'delta-negative' },
  ];

  return (
    <div className="page">
      {comparisonView}
      <button className="btn-tertiary btn-sm mb-2" onClick={() => router.back()}>← {copy.a11y.back}</button>
      <h1 style={{ fontSize: '1.5rem' }}>
        {copy.history.comparison(
          from ? formatDate(from.createdAt) : '—',
          to ? formatDate(to.createdAt) : '—',
        )}
      </h1>

      <div className="stack-lg mt-4">
        {groups
          .filter((g) => g.list.length > 0)
          .map((g) => (
            <section key={g.key} className="card">
              <div className="spread">
                <h2 style={{ margin: 0, fontSize: '1.125rem' }}>{copy.history.groups[g.key]}</h2>
                <span className={`delta ${g.deltaClass} tnum`}>{g.list.length}</span>
              </div>
              {g.key === 'vanished' && (
                <p className="micro faint mt-2">{copy.history.vanishedNote}</p>
              )}
              <div className="stack mt-2">
                {g.list.slice(0, 50).map((u) => (
                  <div key={u} className="row" style={{ minHeight: 48 }}>
                    <Monogram username={u} size={28} />
                    <Link href={`/account/${encodeURIComponent(u)}`}>
                      <bdi>@{u}</bdi>
                    </Link>
                  </div>
                ))}
                {g.list.length > 50 && (
                  <p className="micro faint" style={{ margin: 0 }}>
                    + {g.list.length - 50} more
                  </p>
                )}
              </div>
            </section>
          ))}
        {groups.every((g) => g.list.length === 0) && (
          <div className="card center">
            <p className="muted" style={{ margin: 0 }}>No changes between these two scans. Steady graph. ✨</p>
          </div>
        )}
      </div>
    </div>
  );
}
