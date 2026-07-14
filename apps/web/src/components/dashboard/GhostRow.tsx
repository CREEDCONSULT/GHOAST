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

/** A short, honest "why" chip from export-derived signals. */
function engagementSummary(ghost: Ghost): string {
  if (ghost.isCloseFriend) return 'Close friend';
  const total = ghost.likesGiven + ghost.commentsGiven;
  if (total === 0) {
    return ghost.engagementUnknown ? 'Engagement not in upload' : 'You never engage';
  }
  const parts: string[] = [];
  if (ghost.likesGiven > 0) parts.push(`${ghost.likesGiven} like${ghost.likesGiven === 1 ? '' : 's'}`);
  if (ghost.commentsGiven > 0)
    parts.push(`${ghost.commentsGiven} comment${ghost.commentsGiven === 1 ? '' : 's'}`);
  return `You gave ${parts.join(' + ')}`;
}

interface GhostRowProps {
  ghost: Ghost;
  userTier: UserTier;
  selected: boolean;
  onSelect: (id: string, checked: boolean) => void;
  onMarkDone: (ghost: Ghost) => void;
  marking: boolean;
}

export default function GhostRow({
  ghost,
  selected,
  onSelect,
  onMarkDone,
  marking,
}: GhostRowProps) {
  const tierColor = TIER_COLORS[ghost.tier];
  const tierLabel = TIER_LABELS[ghost.tier];
  const isTier5 = ghost.tier === 5;
  const profileUrl = `https://www.instagram.com/${ghost.handle}/`;

  return (
    <div className="ghost-row">
      {/* Selection checkbox (Tier 5 auto-protected) */}
      <div title={isTier5 ? 'Auto-protected — keep following' : undefined}>
        <input
          type="checkbox"
          className="ghost-checkbox"
          checked={selected}
          disabled={isTier5}
          onChange={(e) => onSelect(ghost.id, e.target.checked)}
        />
      </div>

      {/* Avatar */}
      <div className="ghost-avatar" style={{ background: avatarColor(ghost.handle) }}>
        {ghost.handle[0]?.toUpperCase() ?? '?'}
      </div>

      {/* Info */}
      <div className="ghost-info">
        <div className="ghost-handle">@{ghost.handle}</div>
        <div className="ghost-name">{engagementSummary(ghost)}</div>
      </div>

      {/* Tier badge */}
      <div
        style={{ display: 'flex', alignItems: 'center', gap: 5, minWidth: 120 }}
        className="hide-mobile"
      >
        <span
          className="tier-dot"
          style={{ background: tierColor, boxShadow: `0 0 5px ${tierColor}88` }}
        />
        <span style={{ fontSize: 12, color: 'var(--muted)', whiteSpace: 'nowrap' as const }}>
          {tierLabel}
        </span>
      </div>

      {/* Score */}
      <div className="ghost-score">{ghost.priorityScore}</div>

      {/* Actions: open the profile on Instagram, then mark it done */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <a
          href={profileUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="btn btn-sm btn-ghost"
          title="Open their profile on Instagram in a new tab"
        >
          Open ↗
        </a>
        <button
          className="btn btn-sm btn-primary"
          onClick={() => onMarkDone(ghost)}
          disabled={marking || isTier5}
          title={isTier5 ? 'Auto-protected' : 'Mark as unfollowed once you have unfollowed them on Instagram'}
          style={isTier5 ? { opacity: 0.35, cursor: 'not-allowed' } : {}}
        >
          {marking ? '…' : 'Done ✓'}
        </button>
      </div>
    </div>
  );
}
