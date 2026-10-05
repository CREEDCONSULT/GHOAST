'use client';

/**
 * S-06 Ghost Board — the aha surface (spec §10). Every number is a door,
 * not a decoration. This replaces the prototype's paywalled teaser entirely:
 * free users see the complete picture.
 */

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useRef, useState } from 'react';
import { bandFor, formatDate } from '@/lib/analysis';
import { copy } from '@/lib/copy';
import { db } from '@/lib/db';
import { deleteSnapshot, getSettings } from '@/lib/store';
import { useIsClient } from '@/lib/hooks';
import { Sheet } from '@/components/Sheet';
import { useToast } from '@/components/Toast';

export default function ResultsPage() {
  const router = useRouter();
  const isClient = useIsClient();
  const { show } = useToast();
  const [infoOpen, setInfoOpen] = useState(false);
  const [coachDismissedLocal, setCoachDismissedLocal] = useState(false);
  const toastShownForScan = useRef<string | null>(null);

  const data = useLiveQuery(async () => {
    const snapshots = await db.snapshots.orderBy('createdAt').reverse().toArray();
    const snapshot = snapshots[0] ?? null;
    if (!snapshot) return { snapshot: null, lanes: null, settings: null };
    const relations = await db.relations
      .where('[snapshotId+direction]')
      .equals([snapshot.id, 'following'])
      .toArray();
    const decisions = await db.decisions.toArray();
    const decided = new Map(decisions.map((d) => [d.username, d.state]));
    let long = 0,
      recent = 0,
      unreviewed = 0,
      saved = 0;
    for (const r of relations) {
      const state = decided.get(r.username.toLowerCase());
      if (state === 'saved') saved++;
      if (!state) {
        unreviewed++;
        const band = bandFor(r.followingSince);
        if (band === 'longstanding') long++;
        else if (band === 'recent') recent++;
      }
    }
    const kept = decisions.filter((d) => d.state === 'kept').length;
    const settings = await getSettings();
    return {
      snapshot,
      lanes: { long, recent, saved, kept, unreviewed },
      settings,
    };
  }, []);

  useEffect(() => {
    // "New scan loaded — filters reset" (spec §11) — once per fresh scan.
    if (!data?.snapshot) return;
    if (toastShownForScan.current === data.snapshot.id) return;
    if (data.snapshot.createdAt > Date.now() - 60_000) {
      toastShownForScan.current = data.snapshot.id;
      if (data.settings && data.settings.seenCoachMarks.includes('ghost-definition')) {
        show(copy.board.newScanToast);
      }
    }
  }, [data?.snapshot, data?.settings, show]);

  // Coach mark (C-21): once-only, persisted.
  const settings = data?.settings;
  const coachDismissed =
    coachDismissedLocal || !settings || settings.seenCoachMarks.includes('ghost-definition');

  const needsUpload = isClient && !!data && !data.snapshot;
  useEffect(() => {
    if (needsUpload) router.replace('/upload');
  }, [needsUpload, router]);

  if (!isClient || !data || needsUpload) {
    return (
      <div className="page stack-lg" aria-busy="true">
        <div className="skeleton" style={{ height: 120 }} />
        <div className="skeleton" style={{ height: 80 }} />
        <div className="skeleton" style={{ height: 200 }} />
      </div>
    );
  }

  if (!data.snapshot || !data.lanes) {
    return null;
  }

  const { snapshot, lanes } = data;
  const c = snapshot.counts;

  return (
    <div className="page">
      <button className="micro muted btn-tertiary btn-sm" onClick={() => setInfoOpen(true)}>
        {copy.board.scanOf(formatDate(snapshot.createdAt))} · {copy.board.relationships(c.following)}
      </button>

      {c.ghosts === 0 ? (
        <div className="card center mt-4">
          <p className="ghost-hero" aria-hidden="true">👻</p>
          <h1 style={{ fontSize: '1.5rem' }}>{copy.board.zeroGhosts}</h1>
          <div className="stack mt-4">
            <Link href="/results/fans" className="btn btn-secondary">{copy.board.fans}</Link>
            <Link href="/results/mutuals" className="btn btn-secondary">{copy.board.mutuals}</Link>
          </div>
        </div>
      ) : (
        <>
          <h1 className="mt-4">
            <span className="stat-value tnum" style={{ fontSize: '3.5rem', display: 'block' }}>
              {copy.board.heroGhost(c.ghosts)}
            </span>
            {copy.board.heroLine}
          </h1>
          {!coachDismissed && (
            <div className="card mt-2" role="note">
              <p className="micro" style={{ margin: 0 }}>{copy.board.ghostDefinition}</p>
              <button
                className="btn-tertiary btn-sm mt-2"
                onClick={() => {
                  setCoachDismissedLocal(true);
                  const seen = [...(data.settings?.seenCoachMarks ?? []), 'ghost-definition'];
                  void import('@/lib/store').then((m) => m.updateSettings({ seenCoachMarks: seen }));
                }}
              >
                Got it
              </button>
            </div>
          )}

          <div className="stat-row mt-4">
            {(
              [
                [copy.board.mutuals, c.mutuals, '/results/mutuals'],
                [copy.board.fans, c.fans, '/results/fans'],
                [copy.board.followingTotal, c.following, '/results/ghosts'],
                [copy.board.followersTotal, c.followers, '/results/fans'],
              ] as const
            ).map(([label, value, href]) => (
              <Link key={label} href={href} className="card card-pressable" style={{ textAlign: 'center', color: 'var(--text-1)' }}>
                <dl style={{ margin: 0 }}>
                  <dt className="caption muted">{label}</dt>
                  <dd className="stat-value tnum" style={{ margin: 0 }}>{value.toLocaleString()}</dd>
                </dl>
              </Link>
            ))}
          </div>

          <div className="stack-lg mt-6">
            <Link href="/results/ghosts?band=longstanding" className="card card-pressable">
              <div className="spread">
                <strong>{copy.board.laneLong}</strong>
                <span className="stat-value tnum">{lanes.long}</span>
              </div>
              <p className="micro muted" style={{ margin: '4px 0 0' }}>{copy.board.laneLongHint}</p>
            </Link>
            <Link href="/results/ghosts?band=recent" className="card card-pressable">
              <div className="spread">
                <strong>{copy.board.laneRecent}</strong>
                <span className="stat-value tnum">{lanes.recent}</span>
              </div>
              <p className="micro muted" style={{ margin: '4px 0 0' }}>{copy.board.laneRecentHint}</p>
            </Link>
            <Link href="/saved" className="card card-pressable">
              <div className="spread">
                <strong>{copy.board.laneSavedKept}</strong>
                <span className="stat-value tnum">{lanes.saved + lanes.kept}</span>
              </div>
              <p className="micro muted" style={{ margin: '4px 0 0' }}>{copy.board.laneSavedKeptHint}</p>
            </Link>
          </div>

          <div className="stack mt-6">
            <Link href="/review" className="btn btn-primary">{copy.board.startReviewing}</Link>
            <Link href="/results/ghosts" className="btn btn-secondary">{copy.board.browseList}</Link>
            <Link href="/upload" className="btn btn-tertiary">{copy.board.addNewScan}</Link>
          </div>
        </>
      )}

      <Sheet open={infoOpen} title={copy.board.snapshotInfo} onClose={() => setInfoOpen(false)}>
        <div className="stack">
          <p className="micro muted" style={{ margin: 0 }}>
            {snapshot.fileName} · {copy.board.scanOf(formatDate(snapshot.createdAt))}
          </p>
          <button
            className="btn btn-danger"
            onClick={() => {
              void deleteSnapshot(snapshot.id).then(() => router.push('/upload'));
            }}
          >
            {copy.board.deleteThisScan}
          </button>
        </div>
      </Sheet>
    </div>
  );
}
