'use client';

/**
 * S-13 Account detail — evidence & provenance, not invented metadata.
 * Replaces the prototype's avatar/counter/account-type rows with facts the
 * export can prove, and says so (spec §S-13 honesty block).
 */

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useLiveQuery } from 'dexie-react-hooks';
import { Monogram } from '@/components/Monogram';
import { openInInstagram } from '@/components/ReturnConfirm';
import { useToast } from '@/components/Toast';
import { formatDate, formatSince } from '@/lib/analysis';
import { copy } from '@/lib/copy';
import { db } from '@/lib/db';
import { setDecision } from '@/lib/store';

export default function AccountDetailPage() {
  const { username: raw } = useParams<{ username: string }>();
  const username = decodeURIComponent(raw).toLowerCase();
  const router = useRouter();
  const { show } = useToast();

  const data = useLiveQuery(async () => {
    const snapshots = await db.snapshots.orderBy('createdAt').toArray();
    const seenIn: { id: string; createdAt: number; fileName: string; direction: string; followingSince: number | null; followerSince: number | null; href: string | null }[] = [];
    for (const s of snapshots) {
      const rels = await db.relations.where('snapshotId').equals(s.id).toArray();
      const rel = rels.find((r) => r.username.toLowerCase() === username);
      if (rel) {
        seenIn.push({
          id: s.id,
          createdAt: s.createdAt,
          fileName: s.fileName,
          direction: rel.direction,
          followingSince: rel.followingSince,
          followerSince: rel.followerSince,
          href: rel.href,
        });
      }
    }
    const decision = await db.decisions.get(username);
    const events = await db.events.where('username').equals(username).reverse().sortBy('ts');
    return { snapshots, seenIn, decision, events: events.reverse() };
  }, [username]);

  if (!data) {
    return <div className="page" aria-busy="true"><div className="skeleton" style={{ height: 320 }} /></div>;
  }

  const latest = data.seenIn[data.seenIn.length - 1];
  const snapshotId = data.snapshots[data.snapshots.length - 1]?.id ?? '';
  const vanished = data.seenIn.length > 0 && data.snapshots.length > 0 && data.seenIn[data.seenIn.length - 1].id !== snapshotId;
  const decision = data.decision;

  const act = (state: 'kept' | 'queued' | 'saved' | null) =>
    void setDecision(username, latest?.href ?? decision?.href ?? null, state, snapshotId).then(() =>
      show(copy.review.undoPrefix(state === 'kept' ? 'Kept' : state === 'queued' ? 'Queued' : state === 'saved' ? 'Saved' : 'Reset', username)),
    );

  return (
    <div className="page" style={{ maxWidth: 480 }}>
      <button className="btn-tertiary btn-sm mb-2" onClick={() => router.back()}>← {copy.a11y.back}</button>

      <div className="card center">
        <Monogram username={username} size={72} />
        <h1 style={{ fontSize: '1.5rem', marginTop: 12, marginBottom: 0 }}>
          <bdi>@{username}</bdi>
        </h1>
        {decision && (
          <p className="mt-2">
            <span className={`badge ${decision.state === 'kept' ? 'badge-kept' : decision.state === 'queued' ? 'badge-queued' : decision.state === 'saved' ? 'badge-saved' : 'badge-handled'}`}>
              {copy.lists.stateChips[decision.state]}
            </span>
          </p>
        )}
      </div>

      {vanished && (
        <div className="card mt-4" role="note">
          <p style={{ margin: 0 }}>{copy.account.changedOrGone}</p>
        </div>
      )}

      {latest && (
        <div className="card mt-4">
          <h2 style={{ fontSize: '1.125rem' }}>{copy.account.factsTitle}</h2>
          <dl className="stack" style={{ margin: 0 }}>
            <div className="spread">
              <dt className="muted">{copy.account.youFollow}</dt>
              <dd style={{ margin: 0 }}>{latest.direction === 'following' || latest.direction === 'mutual' ? '✓' : '✗'}</dd>
            </div>
            <div className="spread">
              <dt className="muted">{copy.account.theyFollow}</dt>
              <dd style={{ margin: 0 }}>{latest.direction === 'follower' || latest.direction === 'mutual' ? '✓' : '✗'}</dd>
            </div>
            {latest.followingSince != null && (
              <div className="spread">
                <dt className="muted">{copy.account.followingSince}</dt>
                <dd style={{ margin: 0 }}>{formatSince(latest.followingSince)}</dd>
              </div>
            )}
            <div className="spread">
              <dt className="muted">{copy.account.memberOfScans}</dt>
              <dd style={{ margin: 0 }} className="tnum">{data.seenIn.length}</dd>
            </div>
          </dl>
          <p className="micro faint mt-4" style={{ margin: 0 }}>
            {copy.account.evidenceSource(latest.fileName)}
          </p>
        </div>
      )}

      <div className="card mt-4">
        <h2 style={{ fontSize: '1.125rem' }}>{copy.account.honestyTitle}</h2>
        <p className="muted" style={{ margin: 0 }}>{copy.account.honestyBody}</p>
      </div>

      {data.events.length > 0 && (
        <div className="card mt-4">
          <h2 style={{ fontSize: '1.125rem' }}>{copy.account.historyTitle}</h2>
          <div className="stack">
            {data.events.slice(0, 10).map((e) => (
              <div key={e.id} className="spread micro">
                <span>{e.action.replace('_', ' ')}</span>
                <span className="faint">{formatDate(e.ts)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="stack mt-4">
        {decision?.state === 'kept' ? (
          <button className="btn btn-secondary" onClick={() => act(null)}>{copy.account.actions.unkeep}</button>
        ) : (
          <button className="btn btn-secondary" onClick={() => act('kept')}>{copy.account.actions.keep}</button>
        )}
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => act('queued')}>{copy.account.actions.queue}</button>
          <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => act('saved')}>{copy.account.actions.saved}</button>
        </div>
        <button className="btn btn-primary" onClick={() => openInInstagram(username, latest?.href ?? decision?.href ?? null)}>
          {copy.account.actions.open}
        </button>
        {decision && (
          <>
            <button className="btn btn-tertiary" onClick={() => act(null)}>{copy.account.actions.reset}</button>
            {(decision.state === 'handled_self' || decision.state === 'handled_verified') && (
              <p className="micro faint center">{copy.account.refollowNote}</p>
            )}
          </>
        )}
        <p className="micro faint center">
          <Link href="/privacy">{copy.footer.privacy}</Link>
        </p>
      </div>
    </div>
  );
}
