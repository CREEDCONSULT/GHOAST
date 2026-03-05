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
  onUnfollow: (ghost: Ghost) => void;
  unfollowingId: string | null;
  loading: boolean;
  dailyUnfollowCount: number;
  dailyUnfollowCap: number;
}

export default function GhostList({
  ghosts,
  userTier,
  selectedIds,
  onSelect,
  onSelectAll,
  onUnfollow,
  unfollowingId,
  loading,
  dailyUnfollowCount,
  dailyUnfollowCap,
}: GhostListProps) {
  const isFree = userTier === 'FREE';
  const selectableGhosts = ghosts.filter((g) => g.tier !== 5);
  const allSelected =
    selectableGhosts.length > 0 &&
    selectableGhosts.every((g) => selectedIds.has(g.id));

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
      <div
        className="ghost-panel"
        style={{
          padding: '60px 24px',
          textAlign: 'center',
        }}
      >
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
        {!isFree && (
          <input
            type="checkbox"
            className="ghost-checkbox"
            checked={allSelected}
            onChange={(e) => onSelectAll(e.target.checked)}
            title="Select all"
          />
        )}
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
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase' as const, color: 'var(--muted)', minWidth: 52, textAlign: 'right' as const }}>
          Followers
        </div>
        {isFree && (
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase' as const, color: 'var(--muted)', minWidth: 80 }}>
            Action
          </div>
        )}
      </div>

      {/* Rows */}
      {ghosts.map((ghost) => (
        <GhostRow
          key={ghost.id}
          ghost={ghost}
          userTier={userTier}
          selected={selectedIds.has(ghost.id)}
          onSelect={onSelect}
          onUnfollow={onUnfollow}
          unfollowing={unfollowingId === ghost.id}
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
            Manual unfollows today:{' '}
            <span
              style={{
                fontFamily: 'DM Mono',
                color: dailyUnfollowCount >= dailyUnfollowCap ? 'var(--red)' : 'var(--ghost-text)',
              }}
            >
              {dailyUnfollowCount} / {dailyUnfollowCap}
            </span>
          </span>
          <a
            href="/pricing"
            style={{
              fontSize: 12,
              color: 'var(--violet)',
              fontWeight: 600,
              textDecoration: 'none',
            }}
          >
            Upgrade for bulk queue →
          </a>
        </div>
      )}
    </div>
  );
}
