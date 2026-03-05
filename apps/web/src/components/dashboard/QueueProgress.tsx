'use client';

import { useEffect, useState, useRef } from 'react';
import { streamQueueStatus, type QueueEvent } from '../../lib/api';
import { Spinner } from '../ui/Spinner';

interface QueueProgressProps {
  accountId: string;
  totalJobs: number;
  onComplete: (removedIds: string[]) => void;
  onCancel: () => void;
  onPause: () => void;
  isPausing: boolean;
  isCancelling: boolean;
}

export default function QueueProgress({
  accountId,
  totalJobs,
  onComplete,
  onCancel,
  onPause,
  isPausing,
  isCancelling,
}: QueueProgressProps) {
  const [completed, setCompleted] = useState(0);
  const [currentHandle, setCurrentHandle] = useState<string | null>(null);
  const [rateLimitUntil, setRateLimitUntil] = useState<Date | null>(null);
  const [done, setDone] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const removedIdsRef = useRef<string[]>([]);
  const abortRef = useRef<AbortController | null>(null);

  // Rate limit countdown
  useEffect(() => {
    if (!rateLimitUntil) return;
    const tick = setInterval(() => {
      const secs = Math.ceil((rateLimitUntil.getTime() - Date.now()) / 1000);
      if (secs <= 0) { setRateLimitUntil(null); setCountdown(null); clearInterval(tick); }
      else setCountdown(secs);
    }, 1000);
    return () => clearInterval(tick);
  }, [rateLimitUntil]);

  // SSE stream
  useEffect(() => {
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    async function run() {
      try {
        for await (const event of streamQueueStatus(accountId)) {
          if (ctrl.signal.aborted) break;
          handleEvent(event);
        }
      } catch {
        // stream closed or error — queue may have completed
      }
    }

    run();
    return () => { ctrl.abort(); };
  }, [accountId]);

  function handleEvent(event: QueueEvent) {
    if (event.type === 'job_completed' && event.success) {
      setCompleted((n) => n + 1);
      // jobId maps to ghost, parent cleans up rows after full completion
    }
    if (event.type === 'job_started') {
      setCurrentHandle(event.ghostHandle);
    }
    if (event.type === 'rate_limit_hit') {
      setRateLimitUntil(new Date(event.pauseUntil));
      setCurrentHandle(null);
    }
    if (event.type === 'queue_completed') {
      setDone(true);
      setCurrentHandle(null);
      onComplete(removedIdsRef.current);
    }
    if (event.type === 'queue_cancelled') {
      setDone(true);
      setCurrentHandle(null);
      onCancel();
    }
  }

  const pct = totalJobs > 0 ? Math.round((completed / totalJobs) * 100) : 0;

  return (
    <div
      style={{
        background: 'var(--slate)',
        border: '1px solid rgba(123,79,255,.3)',
        borderRadius: 16,
        padding: 24,
        marginTop: 16,
        animation: 'fadeUp .2s ease both',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 16,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {!done && <span className="pulse-dot" />}
          <span style={{ fontSize: 14, fontWeight: 700 }}>
            {done ? 'Queue complete' : rateLimitUntil ? 'Rate limit — paused' : 'Queue running'}
          </span>
        </div>
        <div
          style={{
            fontFamily: 'DM Mono',
            fontSize: 14,
            color: 'var(--ghost-text)',
          }}
        >
          <span style={{ color: 'var(--green)' }}>{completed}</span>
          <span style={{ color: 'var(--muted)' }}>/{totalJobs}</span>
        </div>
      </div>

      {/* Progress bar */}
      <div
        style={{
          height: 6,
          background: 'var(--specter)',
          borderRadius: 4,
          overflow: 'hidden',
          marginBottom: 14,
        }}
      >
        <div
          style={{
            height: '100%',
            width: `${pct}%`,
            background: done ? 'var(--green)' : 'var(--grad)',
            borderRadius: 4,
            transition: 'width .4s ease',
          }}
        />
      </div>

      {/* Status line */}
      {rateLimitUntil && countdown !== null ? (
        <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 14 }}>
          Instagram rate limit hit. Resuming in{' '}
          <span
            style={{ fontFamily: 'DM Mono', color: '#FFD166', fontWeight: 500 }}
          >
            {countdown}s
          </span>
        </div>
      ) : currentHandle && !done ? (
        <div
          style={{
            fontSize: 13,
            color: 'var(--muted)',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            marginBottom: 14,
          }}
        >
          <Spinner size={12} />
          Unfollowing{' '}
          <span style={{ color: 'var(--ghost-text)', fontWeight: 600 }}>@{currentHandle}</span>
        </div>
      ) : done ? (
        <div style={{ fontSize: 13, color: 'var(--green)', marginBottom: 14 }}>
          {completed} {completed === 1 ? 'account' : 'accounts'} ghosted. Cleaned.
        </div>
      ) : null}

      {/* Controls */}
      {!done && (
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            className="btn btn-ghost btn-sm"
            onClick={onPause}
            disabled={isPausing || isCancelling}
          >
            {isPausing ? <Spinner size={12} /> : 'Pause'}
          </button>
          <button
            className="btn btn-danger btn-sm"
            onClick={onCancel}
            disabled={isPausing || isCancelling}
          >
            {isCancelling ? <Spinner size={12} /> : 'Cancel'}
          </button>
        </div>
      )}
    </div>
  );
}
