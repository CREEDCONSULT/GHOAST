'use client';

import type { Ghost, UserTier } from '../../lib/api';
import GhostRow from './GhostRow';
import { SkeletonRow } from '../ui/Spinner';

interface GhostListProps {
  ghosts: Ghost[];
  userTier: UserTier;
  selectedIds: Set<string>;
  onSelect: (id: string, checked: boolean) => void;
  onSelectAll: (checked: boolean) => void;
  onMarkDone: (ghost: Ghost) => void;
  markingId: string | null;
  loading: boolean;
  dailyCleanupCount: number;
  dailyCleanupCap: number;
}

export default function GhostList({
  ghosts,
  userTier,
  selectedIds,
  onSelect,
  onSelectAll,
  onMarkDone,
  markingId,
  loading,
  dailyCleanupCount,
  dailyCleanupCap,
}: GhostListProps) {
  const isFree = userTier === 'FREE';
  const selectableGhosts = ghosts.filter((g) => g.tier !== 5);
  const allSelected =
    selectableGhosts.length > 0 && selectableGhosts.every((g) => selectedIds.has(g.id));

  if (loading) {
    return (
      <div className="ghost-panel">
        {[...Array(6)].map((_, i) => (
          <SkeletonRow key={i} />
        ))}
      </div>
    );
  }

  if (ghosts.length === 0) {
    return (
      <div className="ghost-panel" style={{ padding: '60px 24px', textAlign: 'center' }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>👻</div>
        <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 6 }}>
          No ghosts here. You&rsquo;re clean.
        </div>
        <div style={{ fontSize: 14, color: 'var(--muted)' }}>
          Your following list looks healthy for this filter.
        </div>
      </div>
    );
  }

  return (
    <div className="ghost-panel">
      {/* Table header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 14,
          padding: '10px 20px',
          borderBottom: '1px solid rgba(123,79,255,.12)',
          background: 'var(--specter)',
        }}
      >
        <input
          type="checkbox"
          className="ghost-checkbox"
          checked={allSelected}
          onChange={(e) => onSelectAll(e.target.checked)}
          title="Select all"
        />
        <div style={{ width: 40, flexShrink: 0 }} />
        <div style={{ flex: 1, fontSize: 11, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase' as const, color: 'var(--muted)' }}>
          Account
        </div>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase' as const, color: 'var(--muted)', minWidth: 120 }} className="hide-mobile">
          Tier
        </div>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase' as const, color: 'var(--muted)', minWidth: 36, textAlign: 'right' as const }}>
          Score
        </div>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase' as const, color: 'var(--muted)', minWidth: 150 }}>
          Cleanup
        </div>
      </div>

      {/* Rows */}
      {ghosts.map((ghost) => (
        <GhostRow
          key={ghost.id}
          ghost={ghost}
          userTier={userTier}
          selected={selectedIds.has(ghost.id)}
          onSelect={onSelect}
          onMarkDone={onMarkDone}
          marking={markingId === ghost.id}
        />
      ))}

      {/* Free tier daily cap footer */}
      {isFree && (
        <div
          style={{
            padding: '10px 20px',
            borderTop: '1px solid rgba(123,79,255,.1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
          }}
        >
          <span style={{ fontSize: 13, color: 'var(--muted)' }}>
            Cleanups tracked today:{' '}
            <span
              style={{
                fontFamily: 'DM Mono',
                color: dailyCleanupCount >= dailyCleanupCap ? 'var(--red)' : 'var(--ghost-text)',
              }}
            >
              {dailyCleanupCount} / {dailyCleanupCap}
            </span>
          </span>
          <a
            href="/pricing"
            style={{ fontSize: 12, color: 'var(--violet)', fontWeight: 600, textDecoration: 'none' }}
          >
            Upgrade for unlimited tracking →
          </a>
        </div>
      )}
    </div>
  );
}
