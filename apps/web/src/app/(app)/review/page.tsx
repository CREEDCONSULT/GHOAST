'use client';

/**
 * S-10 Review mode — the card deck; the product's soul (spec §12).
 * Four reversible verbs: Keep · Queue · Later · Skip.
 * Gestures (mobile): ←Queue · →Keep · ↑Later · ↓Skip.
 * Keyboard (desktop): ←→↑↓, K/Q/L/S, U undo, G open profile.
 * Session pauses/resumes; progress is "decisions this session".
 *
 * DESIGN NOTE (spec §12): bulk Queue is deliberately not offered anywhere;
 * queueing happens one card at a time so pace stays human and Instagram-safe.
 */

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useLiveQuery } from 'dexie-react-hooks';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { track } from '@/lib/analytics';
import { bandFor, bandLabel, formatDuration, formatSince } from '@/lib/analysis';
import { Monogram } from '@/components/Monogram';
import { useToast } from '@/components/Toast';
import { openInInstagram } from '@/components/ReturnConfirm';
import { copy } from '@/lib/copy';
import { db } from '@/lib/db';
import { setDecision } from '@/lib/store';
import type { DecisionState } from '@/lib/types';

type Verb = 'kept' | 'queued' | 'saved' | 'skipped';

const DRAG_THRESHOLD = 90;

export default function ReviewPage() {
  const router = useRouter();
  const { show } = useToast();
  const [index, setIndex] = useState(0);
  const [sessionDone, setSessionDone] = useState(0);
  const [sessionVerbs, setSessionVerbs] = useState({ queued: 0, kept: 0, saved: 0, skipped: 0 });
  const [drag, setDrag] = useState<{ x: number; y: number } | null>(null);
  const [showWhy, setShowWhy] = useState(false);
  const [lastAction, setLastAction] = useState<{ username: string; href: string | null; verb: Verb } | null>(null);
  const dragStart = useRef<{ x: number; y: number } | null>(null);
  const trackedStart = useRef(false);

  const data = useLiveQuery(async () => {
    const snapshots = await db.snapshots.orderBy('createdAt').reverse().limit(1).toArray();
    const snapshot = snapshots[0] ?? null;
    if (!snapshot) return null;
    const relations = await db.relations
      .where('[snapshotId+direction]')
      .equals([snapshot.id, 'following'])
      .toArray();
    const decisions = await db.decisions.toArray();
    const decided = new Map(decisions.map((d) => [d.username, d.state]));
    // Deck = unreviewed ghosts only; kept/queued/saved leave the deck forever
    // unless the user moves them back (spec §11 taxonomy).
    const deck = relations
      .filter((r) => !decided.has(r.username.toLowerCase()))
      .sort((a, b) => (a.followingSince ?? Number.MAX_SAFE_INTEGER) - (b.followingSince ?? Number.MAX_SAFE_INTEGER));
    return { snapshot, deck, totalUnreviewed: deck.length };
  }, []);

  const decide = useCallback(
    (verb: Verb) => {
      if (!data || data.deck.length === 0) return;
      const card = data.deck[Math.min(index, data.deck.length - 1)];
      if (!card) return;
      const snapshotId = data.snapshot.id;

      if (verb === 'skipped') {
        setIndex((i) => i + 1);
        setSessionDone((d) => d + 1);
        setSessionVerbs((v) => ({ ...v, skipped: v.skipped + 1 }));
        setLastAction({ username: card.username, href: card.href, verb });
        return;
      }
      const state: DecisionState = verb;
      void setDecision(card.username, card.href, state, snapshotId).then(() => {
        setLastAction({ username: card.username, href: card.href, verb });
        const label =
          verb === 'kept' ? 'Kept' : verb === 'queued' ? 'Queued' : 'Saved';
        show(copy.review.undoPrefix(label, card.username), () => {
          void setDecision(card.username, card.href, null, snapshotId);
        });
      });
      setSessionDone((d) => d + 1);
      setSessionVerbs((v) => ({ ...v, [verb]: v[verb] + 1 }));
      setShowWhy(false);
    },
    [data, index, show],
  );

  // Keyboard: ←Queue · →Keep · ↑Later · ↓Skip · U undo · G open profile (? shortcuts listed)
  useEffect(() => {
    if (!trackedStart.current && (data?.deck.length ?? 0) > 0) {
      trackedStart.current = true;
      void track('triage_start');
    }
  }, [data?.deck.length]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.target as HTMLElement)?.tagName === 'INPUT') return;
      switch (e.key) {
        case 'ArrowLeft':
        case 'q':
          decide('queued');
          break;
        case 'ArrowRight':
        case 'k':
          decide('kept');
          break;
        case 'ArrowUp':
        case 'l':
          decide('saved');
          break;
        case 'ArrowDown':
        case 's':
          decide('skipped');
          break;
        case 'u':
          if (lastAction && lastAction.verb !== 'skipped' && data) {
            void setDecision(lastAction.username, lastAction.href, null, data.snapshot.id);
            setSessionDone((d) => Math.max(0, d - 1));
            setLastAction(null);
          }
          break;
        case 'g': {
          const card = data?.deck[Math.min(index, (data?.deck.length ?? 1) - 1)];
          if (card) openInInstagram(card.username, card.href);
          break;
        }
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [decide, lastAction, data, index]);

  const onPointerDown = (e: React.PointerEvent) => {
    dragStart.current = { x: e.clientX, y: e.clientY };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragStart.current) return;
    setDrag({ x: e.clientX - dragStart.current.x, y: e.clientY - dragStart.current.y });
  };
  const onPointerUp = () => {
    if (!drag) {
      dragStart.current = null;
      return;
    }
    const { x, y } = drag;
    dragStart.current = null;
    setDrag(null);
    if (Math.abs(x) < DRAG_THRESHOLD && Math.abs(y) < DRAG_THRESHOLD) return;
    if (Math.abs(x) > Math.abs(y)) decide(x < 0 ? 'queued' : 'kept');
    else decide(y < 0 ? 'saved' : 'skipped');
  };

  const dragClass = useMemo(() => {
    if (!drag || (Math.abs(drag.x) < 24 && Math.abs(drag.y) < 24)) return '';
    if (Math.abs(drag.x) > Math.abs(drag.y)) return drag.x < 0 ? 'drag-queue' : 'drag-keep';
    return drag.y < 0 ? 'drag-later' : '';
  }, [drag]);

  const needsUpload = data === null;
  useEffect(() => {
    if (needsUpload) router.replace('/upload');
  }, [needsUpload, router]);

  if (data === undefined || data === null) {
    return (
      <div className="page" aria-busy="true">
        <div className="skeleton" style={{ height: 320 }} />
      </div>
    );
  }

  const { deck } = data;
  const finished = deck.length === 0 || index >= deck.length;
  const card = finished ? null : deck[Math.min(index, deck.length - 1)];
  const behind = !finished ? deck[Math.min(index + 1, deck.length - 1)] : null;

  return (
    <div className="page">
      {/* Progress header (C-12) */}
      <div className="spread mb-2">
        <span className="micro muted tnum">
          {copy.review.progress(sessionDone, sessionDone + deck.length)}
        </span>
        <span className="micro faint">{copy.review.gesturesHint}</span>
      </div>
      <div
        className="progress-track"
        role="progressbar"
        aria-label={copy.review.progress(sessionDone, sessionDone + deck.length)}
        aria-valuemin={0}
        aria-valuemax={sessionDone + deck.length}
        aria-valuenow={sessionDone}
      >
        <div
          className="progress-fill"
          style={{
            width: `${sessionDone + deck.length === 0 ? 100 : (sessionDone / (sessionDone + deck.length)) * 100}%`,
          }}
        />
      </div>

      {finished ? (
        <div className="card center mt-6">
          <p className="ghost-hero" aria-hidden="true">👻</p>
          <h1 style={{ fontSize: '1.5rem' }}>{sessionDone > 0 ? copy.review.finishedTitle : copy.review.empty}</h1>
          {sessionDone > 0 && (
            <p className="muted">
              {copy.review.finishedBody(sessionVerbs.queued, sessionVerbs.kept, sessionVerbs.saved)}
            </p>
          )}
          <div className="stack mt-4">
            <Link href="/activity" className="btn btn-primary">{copy.review.openQueue}</Link>
            <Link href="/results" className="btn btn-secondary">{copy.review.doneForNow}</Link>
          </div>
        </div>
      ) : (
        card && (
          <>
            <div
              className="deck-area"
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
            >
              {behind && behind !== card && (
                <div className="triage-card behind" aria-hidden="true">
                  <Monogram username={behind.username} size={64} />
                </div>
              )}
              <div
                className={`triage-card ${dragClass}`}
                style={
                  drag
                    ? {
                        transform: `translate(${drag.x}px, ${drag.y}px) rotate(${drag.x / 18}deg)`,
                      }
                    : undefined
                }
              >
                <Monogram username={card.username} size={72} />
                <h2 className="mt-4" style={{ marginBottom: 0 }}>
                  <Link href={`/account/${encodeURIComponent(card.username)}`} style={{ color: 'var(--text-1)' }}>
                    <bdi>@{card.username}</bdi>
                  </Link>
                </h2>
                <p className="micro muted mt-2">
                  {(() => {
                    const since = formatSince(card.followingSince);
                    return since
                      ? copy.lists.evidenceGhost(since)
                      : copy.lists.evidenceGhost(null);
                  })()}
                </p>
                {card.followingSince != null && (
                  <p className="micro faint">
                    {bandLabel(bandFor(card.followingSince))} · {formatDuration(card.followingSince)} one-way
                  </p>
                )}
                <p className="mt-4">
                  <button className="btn-tertiary btn-sm" onClick={() => setShowWhy((v) => !v)} aria-expanded={showWhy}>
                    {copy.lists.why}
                  </button>
                </p>
                {showWhy && (
                  <p className="micro muted" role="note">
                    {copy.review.whyBody(card.username, formatSince(card.followingSince))}
                  </p>
                )}
                <a
                  className="btn-tertiary btn-sm"
                  href={`https://instagram.com/${encodeURIComponent(card.username)}`}
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                  onClick={(e) => {
                    e.preventDefault();
                    openInInstagram(card.username, card.href);
                  }}
                >
                  {copy.review.viewProfile}
                </a>
              </div>
            </div>

            {/* Action bar (C-11) */}
            <div className="action-bar">
              <button className="btn btn-danger btn-sm" style={{ background: 'var(--accent)' }} onClick={() => decide('queued')} title={copy.review.queueHint}>
                ← {copy.review.buttons.queue}
              </button>
              <button className="btn btn-secondary btn-sm" onClick={() => decide('saved')} title={copy.review.laterHint}>
                ↑ {copy.review.buttons.later}
              </button>
              <button className="btn btn-secondary btn-sm" onClick={() => decide('skipped')} title={copy.review.skipHint}>
                ↓ {copy.review.buttons.skip}
              </button>
              <button className="btn btn-sm" style={{ background: 'var(--mint-400)', color: '#06281c' }} onClick={() => decide('kept')} title={copy.review.keepHint}>
                {copy.review.buttons.keep} →
              </button>
            </div>
          </>
        )
      )}
    </div>
  );
}
