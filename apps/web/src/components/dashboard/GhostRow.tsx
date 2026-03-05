'use client';

import type { Ghost, UserTier } from '../../lib/api';
import { TIER_COLORS, TIER_LABELS } from './TierFilterTabs';

// Deterministic avatar colour from handle
function avatarColor(handle: string): string {
  const COLORS = ['#7B4FFF', '#00E5FF', '#FF7A3E', '#FFD166', '#00E676', '#FF3E3E'];
  let hash = 0;
  for (const ch of handle) hash = (hash * 31 + ch.charCodeAt(0)) & 0xffffffff;
  return COLORS[Math.abs(hash) % COLORS.length];
}

function fmtFollowers(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

interface GhostRowProps {
  ghost: Ghost;
  userTier: UserTier;
  selected: boolean;
  onSelect: (id: string, checked: boolean) => void;
  onUnfollow: (ghost: Ghost) => void;
  unfollowing: boolean;
}

export default function GhostRow({
  ghost,
  userTier,
  selected,
  onSelect,
  onUnfollow,
  unfollowing,
}: GhostRowProps) {
  const tierColor = TIER_COLORS[ghost.tier];
  const tierLabel = TIER_LABELS[ghost.tier];
  const isFree = userTier === 'FREE';
  const isTier5 = ghost.tier === 5;

  return (
    <div className="ghost-row">
      {/* Selection: free users get unfollow button inline; pro gets checkbox */}
      {isFree ? null : (
        <div title={isTier5 ? 'Auto-protected' : undefined}>
          <input
            type="checkbox"
            className="ghost-checkbox"
            checked={selected}
            disabled={isTier5}
            onChange={(e) => onSelect(ghost.id, e.target.checked)}
          />
        </div>
      )}

      {/* Avatar */}
      <div
        className="ghost-avatar"
        style={{ background: avatarColor(ghost.handle) }}
      >
        {ghost.handle[0]?.toUpperCase() ?? '?'}
      </div>

      {/* Info */}
      <div className="ghost-info">
        <div className="ghost-handle">@{ghost.handle}</div>
        <div className="ghost-name">{ghost.displayName || ghost.handle}</div>
      </div>

      {/* Tier badge */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 5,
          minWidth: 120,
        }}
        className="hide-mobile"
      >
        <span
          className="tier-dot"
          style={{
            background: tierColor,
            boxShadow: `0 0 5px ${tierColor}88`,
          }}
        />
        <span style={{ fontSize: 12, color: 'var(--muted)', whiteSpace: 'nowrap' as const }}>
          {tierLabel}
        </span>
      </div>

      {/* Score */}
      <div className="ghost-score">{ghost.priorityScore}</div>

      {/* Followers */}
      <div className="ghost-followers">{fmtFollowers(ghost.followersCount)}</div>

      {/* Action */}
      {isFree && (
        <button
          className="btn btn-sm btn-ghost"
          onClick={() => onUnfollow(ghost)}
          disabled={unfollowing || isTier5}
          title={isTier5 ? 'Auto-protected' : undefined}
          style={isTier5 ? { opacity: 0.35, cursor: 'not-allowed' } : {}}
        >
          {unfollowing ? '...' : 'Unfollow'}
        </button>
      )}
    </div>
  );
}
