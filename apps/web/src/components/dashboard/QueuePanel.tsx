'use client';

import type { Ghost } from '../../lib/api';
import { TIER_COLORS, TIER_LABELS } from './TierFilterTabs';
import { Spinner } from '../ui/Spinner';

interface QueuePanelProps {
  selectedGhosts: Ghost[];
  onStart: () => void;
  onClear: () => void;
  starting: boolean;
}

export default function QueuePanel({
  selectedGhosts,
  onStart,
  onClear,
  starting,
}: QueuePanelProps) {
  if (selectedGhosts.length === 0) return null;

  // Count by tier
  const byTier = selectedGhosts.reduce<Record<number, number>>((acc, g) => {
    acc[g.tier] = (acc[g.tier] ?? 0) + 1;
    return acc;
  }, {});

  // Estimated time: 8–45s average = ~26.5s per unfollow + pauses
  const estSeconds = selectedGhosts.length * 27;
  const estMins = Math.ceil(estSeconds / 60);

  return (
    <div className="queue-panel">
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 16,
          flexWrap: 'wrap' as const,
        }}
      >
        {/* Selection summary */}
        <div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 10 }}>
            <span
              style={{
                fontFamily: 'DM Mono',
                fontSize: 28,
                fontWeight: 500,
                color: 'var(--ghost-text)',
              }}
            >
              {selectedGhosts.length}
            </span>
            <span style={{ fontSize: 15, color: 'var(--muted)' }}>
              {selectedGhosts.length === 1 ? 'ghost' : 'ghosts'} selected
            </span>
          </div>

          {/* Tier breakdown */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' as const }}>
            {[1, 2, 3, 4].map((tier) => {
              const count = byTier[tier];
              if (!count) return null;
              return (
                <div
                  key={tier}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 5,
                    background: 'var(--specter)',
                    border: `1px solid ${TIER_COLORS[tier]}44`,
                    borderRadius: 8,
                    padding: '3px 9px',
                    fontSize: 12,
                  }}
                >
                  <span
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: '50%',
                      background: TIER_COLORS[tier],
                      display: 'inline-block',
                    }}
                  />
                  <span style={{ color: 'var(--muted)' }}>{TIER_LABELS[tier]}:</span>
                  <span style={{ fontFamily: 'DM Mono', color: 'var(--ghost-text)' }}>{count}</span>
                </div>
              );
            })}
          </div>

          <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 8 }}>
            Est. completion:{' '}
            <span style={{ color: 'var(--ghost-text)' }}>
              ~{estMins < 60 ? `${estMins} min` : `${Math.ceil(estMins / 60)} hr`}
            </span>
            {' '}(including safety pauses)
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <button className="btn btn-ghost btn-sm" onClick={onClear} disabled={starting}>
            Clear
          </button>
          <button
            className="btn btn-primary"
            onClick={onStart}
            disabled={starting}
            style={{ gap: 8 }}
          >
            {starting ? (
              <>
                <Spinner size={16} /> Starting…
              </>
            ) : (
              'Ghost the Ghosts →'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
